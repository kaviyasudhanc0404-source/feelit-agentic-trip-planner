import asyncio
import uuid

import jwt
from fastapi import APIRouter, Depends, HTTPException
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from app.db import now, users
from app.schemas import GoogleIn, LoginIn, PasswordCheckIn, PasswordIn, ProfileIn, RegisterIn
from app.security import auth_limit, create_token, current_user, hash_password, public_user, verify_google_token, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])
WRONG_PASSWORD = "That password isn't right."


def _session(user: dict) -> dict:
    return {"token": create_token(user), "user": public_user(user)}


@router.post("/register", status_code=201, dependencies=[Depends(auth_limit)])
async def register(body: RegisterIn):
    email = body.email.lower()
    hashed = await asyncio.to_thread(hash_password, body.password)  # bcrypt is slow on purpose: keep it off the event loop
    user = {"_id": uuid.uuid4().hex, "name": body.name, "email": email, "password_hash": hashed, "created_at": now()}
    try:
        await users.insert_one(user)
    except DuplicateKeyError:
        existing = await users.find_one({"email": email}, {"password_hash": 1})
        if existing and "password_hash" not in existing:
            raise HTTPException(409, "This email signs in with Google. Continue with Google, then set a password in your profile.") from None
        raise HTTPException(409, "An account with this email already exists. Please sign in.") from None
    return _session(user)


@router.post("/login", dependencies=[Depends(auth_limit)])
async def login(body: LoginIn):
    user = await users.find_one({"email": body.email.lower()})
    if user and "password_hash" not in user:
        raise HTTPException(401, "This account uses Google. Continue with Google, or set a password in your profile first.")
    if not user or not await asyncio.to_thread(verify_password, body.password, user["password_hash"]):
        raise HTTPException(401, "Wrong email or password.")
    return _session(user)


@router.post("/google")
async def google(body: GoogleIn):
    """Sign in or sign up with Google: one account per email, created on first use."""
    try:
        claims = await asyncio.to_thread(verify_google_token, body.id_token)
    except jwt.PyJWTError:
        raise HTTPException(401, "Google sign-in couldn't be verified. Please try again.") from None
    email = (claims.get("email") or "").lower()
    if not email or not claims.get("email_verified"):
        raise HTTPException(401, "Your Google account has no verified email address.")
    user = await users.find_one_and_update(
        {"email": email},
        {"$setOnInsert": {"_id": uuid.uuid4().hex, "name": claims.get("name") or email.split("@")[0], "created_at": now()}},
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )
    return _session(user)


@router.get("/me")
async def me(user: dict = Depends(current_user)):
    return public_user(user)


@router.patch("/me")
async def update_me(body: ProfileIn, user: dict = Depends(current_user)):
    changes = body.model_dump(exclude_none=True)
    cleared = {field: "" for field, value in changes.items() if value == ""}  # a blank value removes the field
    kept = {field: value for field, value in changes.items() if field not in cleared}
    update = {op: fields for op, fields in (("$set", kept), ("$unset", cleared)) if fields}
    if update:
        await users.update_one({"_id": user["_id"]}, update)
    updated = {key: value for key, value in {**user, **kept}.items() if key not in cleared}
    return public_user(updated)


async def _confirm_current(user: dict, password: str | None) -> None:
    """Raise unless `password` is the account's current password (accounts without one have nothing to confirm)."""
    if "password_hash" not in user:
        return
    if not password or not await asyncio.to_thread(verify_password, password, user["password_hash"]):
        raise HTTPException(403, WRONG_PASSWORD)


@router.post("/password/check", status_code=204, dependencies=[Depends(auth_limit)])
async def check_password(body: PasswordCheckIn, user: dict = Depends(current_user)):
    """Step one of changing a password: confirm the current one before new fields are shown."""
    await _confirm_current(user, body.password)


@router.post("/password", dependencies=[Depends(auth_limit)])
async def set_password(body: PasswordIn, user: dict = Depends(current_user)):
    """Change the password (current one required), or set a first password on a Google-only account.

    Every other session is signed out; this one gets a fresh token.
    """
    await _confirm_current(user, body.current_password)
    if "password_hash" in user and await asyncio.to_thread(verify_password, body.new_password, user["password_hash"]):
        raise HTTPException(400, "Your new password must be different from the current one.")
    changes = {"password_hash": await asyncio.to_thread(hash_password, body.new_password), "pv": user.get("pv", 0) + 1, "password_changed_at": now()}
    await users.update_one({"_id": user["_id"]}, {"$set": changes})
    return _session({**user, **changes})

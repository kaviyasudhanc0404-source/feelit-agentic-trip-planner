"""Password hashing, JWT tokens and the auth / rate-limit dependencies."""
from datetime import timedelta

import bcrypt
import jwt
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import settings
from app.db import enforce_limit, now, users

bearer = HTTPBearer(auto_error=False)
# Google's public keys for Firebase sign-in tokens (fetched once, then cached).
google_keys = jwt.PyJWKClient(
    "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com", lifespan=6 * 3600
)
GUEST_LIMIT_PER_HOUR = 12
AUTH_ATTEMPTS_PER_HOUR = 20  # sign-in, sign-up and password checks, per IP address (slows password guessing)


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())


def create_token(user: dict) -> str:
    """A session token. `pv` (password version) lets a password change sign out every other session."""
    payload = {"sub": user["_id"], "pv": user.get("pv", 0), "exp": now() + timedelta(days=settings.jwt_expires_days)}
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def verify_google_token(id_token: str) -> dict:
    """Check a Firebase ID token's signature, expiry, project and issuer; returns its claims.

    Raises jwt.PyJWTError if anything is wrong. Blocking (may fetch keys), so call it in a thread.
    """
    project = settings.firebase_project_id
    key = google_keys.get_signing_key_from_jwt(id_token)
    return jwt.decode(id_token, key.key, algorithms=["RS256"], audience=project, issuer=f"https://securetoken.google.com/{project}")


def public_user(user: dict) -> dict:
    return {
        "id": user["_id"],
        "name": user["name"],
        "email": user["email"],
        "home_city": user.get("home_city"),
        "phone": user.get("phone"),
        "style": user.get("style", "comfort"),
        "food_pref": user.get("food_pref", "any"),
        "has_password": "password_hash" in user,
        "trip_reminders": user.get("trip_reminders", True),
    }


async def optional_user(creds: HTTPAuthorizationCredentials | None = Depends(bearer)) -> dict | None:
    if not creds:
        return None
    try:
        claims = jwt.decode(creds.credentials, settings.jwt_secret, algorithms=["HS256"])
    except jwt.PyJWTError:
        raise HTTPException(401, "Your session has expired. Please sign in again.") from None
    user = await users.find_one({"_id": claims.get("sub")})
    if not user:
        raise HTTPException(401, "Account not found. Please sign in again.")
    if claims.get("pv", 0) != user.get("pv", 0):
        raise HTTPException(401, "Your password was changed. Please sign in again.")
    return user


async def current_user(user: dict | None = Depends(optional_user)) -> dict:
    if not user:
        raise HTTPException(401, "Please sign in to continue.")
    return user


def client_ip(request: Request) -> str:
    """The caller's IP address for rate limits.

    Behind the hosting proxy the last X-Forwarded-For entry is the one the proxy itself added;
    earlier entries come from the client and can be faked to dodge the limits.
    """
    forwarded = request.headers.get("x-forwarded-for")
    return forwarded.split(",")[-1].strip() if forwarded else (request.client.host if request.client else "unknown")


async def auth_limit(request: Request) -> None:
    await enforce_limit(f"auth:{client_ip(request)}", AUTH_ATTEMPTS_PER_HOUR, "Too many attempts. Please wait a while and try again.")


async def ai_limit(request: Request, user: dict | None = Depends(optional_user)) -> None:
    """Protect the free AI and search quotas: per user when signed in, per IP for guests."""
    if user:
        await enforce_limit(f"user:{user['_id']}", settings.ai_rate_limit_per_hour)
    else:
        await enforce_limit(f"ip:{client_ip(request)}", GUEST_LIMIT_PER_HOUR)

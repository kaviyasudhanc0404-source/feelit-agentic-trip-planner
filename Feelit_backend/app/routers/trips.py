import secrets

from fastapi import APIRouter, Depends, HTTPException

from app.db import trips
from app.routers.stream import sse
from app.schemas import Brief, ChatIn, ShareIn, TripUpdate
from app.security import ai_limit, current_user
from app.services.agent import assist_trip
from app.services.editor import apply_edit
from app.services.planner import plan_trip

router = APIRouter(prefix="/trips", tags=["trips"])
CARD_FIELDS = ["title", "summary", "destination", "start_date", "end_date", "travellers", "style", "budget", "cover", "is_public"]


def public_trip(trip: dict, owner: bool = True) -> dict:
    hidden = {"_id", "user_id"} if owner else {"_id", "user_id", "chat", "brief"}
    return {"id": trip["_id"], **{k: v for k, v in trip.items() if k not in hidden}}


async def own_trip(trip_id: str, user: dict = Depends(current_user)) -> dict:
    trip = await trips.find_one({"_id": trip_id, "user_id": user["_id"]})
    if not trip:
        raise HTTPException(404, "Trip not found.")
    return trip


@router.post("/plan", dependencies=[Depends(ai_limit)])
async def plan(body: Brief, user: dict = Depends(current_user)):
    """Build a trip from a confirmed brief. Streams progress, ending with the new trip's id."""
    return sse(plan_trip(body, user))


@router.get("")
async def list_trips(user: dict = Depends(current_user)):
    cursor = trips.find({"user_id": user["_id"]}, CARD_FIELDS).sort("start_date", 1)
    return [public_trip(trip) async for trip in cursor]


@router.get("/shared/{share_id}")
async def shared_trip(share_id: str):
    trip = await trips.find_one({"share_id": share_id, "is_public": True})
    if not trip:
        raise HTTPException(404, "This shared trip is no longer available.")
    return public_trip(trip, owner=False)


@router.get("/{trip_id}")
async def get_trip(trip: dict = Depends(own_trip)):
    return public_trip(trip)


@router.patch("/{trip_id}")
async def edit_trip(body: TripUpdate, trip: dict = Depends(own_trip)):
    """Save edits from the trip editor."""
    changes = await apply_edit(trip, body)
    if changes:
        await trips.update_one({"_id": trip["_id"]}, {"$set": changes})
    return public_trip({**trip, **changes})


@router.delete("/{trip_id}", status_code=204)
async def delete_trip(trip: dict = Depends(own_trip)):
    await trips.delete_one({"_id": trip["_id"]})


@router.post("/{trip_id}/share")
async def share_trip(body: ShareIn, trip: dict = Depends(own_trip)):
    changes = {"is_public": body.public, "share_id": trip.get("share_id") or secrets.token_urlsafe(9)}
    await trips.update_one({"_id": trip["_id"]}, {"$set": changes})
    return changes


@router.post("/{trip_id}/chat", dependencies=[Depends(ai_limit)])
async def chat(body: ChatIn, trip: dict = Depends(own_trip)):
    """Ask the trip assistant. Streams tool steps, ending with the (possibly updated) trip."""
    async def events():
        async for event in assist_trip(trip, body.message):
            yield {**event, "trip": public_trip(event["trip"])} if "trip" in event else event

    return sse(events())

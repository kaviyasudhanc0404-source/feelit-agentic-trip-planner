"""Trip reminders: one email per trip, sent the evening before it starts (India time).

A trip is due from 8 PM the day before it starts until noon on its first day (so a run that was
missed, e.g. while the server slept, still catches up). Each trip is claimed in the database before
sending, so overlapping runs or several server instances can never send it twice.
"""
import asyncio
from datetime import date, datetime, time, timedelta, timezone

from app.db import now, trips, users
from app.services import reminder_email, weather
from app.services.email import email_enabled, send_email
from app.services.http import log

IST = timezone(timedelta(hours=5, minutes=30), "IST")  # India has one time zone and no daylight saving
SEND_FROM = time(20)  # the evening before the trip
LAST_CALL = time(12)  # catch-up limit on the first day
MAX_ATTEMPTS = 3
RUN_EVERY_SECONDS = 30 * 60


def window(start: date) -> tuple[datetime, datetime]:
    """When a trip starting on `start` may get its reminder."""
    return datetime.combine(start - timedelta(days=1), SEND_FROM, IST), datetime.combine(start, LAST_CALL, IST)


async def _remind(trip: dict, moment: datetime) -> str:
    """Send one trip's reminder. Returns what happened: sent, skipped, retry or failed."""
    user = await users.find_one({"_id": trip["user_id"]})
    if not user or not user.get("trip_reminders", True):
        await trips.update_one({"_id": trip["_id"]}, {"$set": {"reminder": {"status": "skipped", "at": now()}}})
        return "skipped"

    start = date.fromisoformat(trip["start_date"])
    when = "tomorrow" if moment.astimezone(IST).date() < start else "today"
    place = trip["destination"]
    forecast = weather.for_dates(await weather.forecast(place["lat"], place["lon"]), [trip["start_date"]])
    subject, html, text = reminder_email.build(trip, user, when, forecast[0] if forecast else None)
    message_id = await send_email(user["email"], user["name"], subject, html, text, tag="trip-reminder")

    if message_id:
        await trips.update_one({"_id": trip["_id"]}, {"$set": {"reminder": {"status": "sent", "at": now(), "message_id": message_id}}})
        return "sent"
    attempts = trip.get("reminder_attempts", 0) + 1
    if attempts < MAX_ATTEMPTS:  # release the claim so the next run tries again
        await trips.update_one({"_id": trip["_id"]}, {"$unset": {"reminder": ""}, "$set": {"reminder_attempts": attempts}})
        return "retry"
    await trips.update_one({"_id": trip["_id"]}, {"$set": {"reminder": {"status": "failed", "at": now()}, "reminder_attempts": attempts}})
    return "failed"


async def send_due_reminders(moment: datetime | None = None) -> dict:
    """Send every reminder that is due at `moment` (default: now). Returns a count per outcome."""
    moment = moment or datetime.now(IST)
    today = moment.astimezone(IST).date()
    summary = {"sent": 0, "skipped": 0, "retry": 0, "failed": 0}
    if not email_enabled():
        return summary
    candidates = trips.find({"start_date": {"$in": [today.isoformat(), (today + timedelta(days=1)).isoformat()]}, "reminder": {"$exists": False}})
    async for trip in candidates:
        opens, closes = window(date.fromisoformat(trip["start_date"]))
        if not opens <= moment < closes:
            continue
        # Claim it first: whoever sets `reminder` owns this trip's one email.
        claimed = await trips.find_one_and_update({"_id": trip["_id"], "reminder": {"$exists": False}}, {"$set": {"reminder": {"status": "sending", "at": now()}}})
        if claimed:
            summary[await _remind(claimed, moment)] += 1
    return summary


async def run_forever() -> None:
    """While the server is awake, check for due reminders every 30 minutes."""
    await asyncio.sleep(60)  # let the app finish starting first
    while True:
        try:
            summary = await send_due_reminders()
            if any(summary.values()):
                log.info("Trip reminders: %s", summary)
        except Exception:
            log.exception("Trip reminder run failed")
        await asyncio.sleep(RUN_EVERY_SECONDS)

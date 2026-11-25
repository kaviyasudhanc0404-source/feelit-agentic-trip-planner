"""MongoDB access: collections, indexes, a TTL cache and a sliding rate limiter."""
from datetime import datetime, timedelta, timezone
from typing import Any, Awaitable, Callable

from fastapi import HTTPException
from pymongo import AsyncMongoClient

from app.config import settings

client: AsyncMongoClient = AsyncMongoClient(
    settings.mongodb_uri, serverSelectionTimeoutMS=20000, tz_aware=True
)
db = client[settings.mongodb_db]
users = db["users"]
trips = db["trips"]
cache = db["cache"]
usage = db["usage"]

HOUR, DAY = 3600, 86400


def now() -> datetime:
    return datetime.now(timezone.utc)


async def init_indexes() -> None:
    await users.create_index("email", unique=True)
    await trips.create_index([("user_id", 1), ("created_at", -1)])
    await trips.create_index("share_id", unique=True, sparse=True)
    await trips.create_index([("start_date", 1), ("reminder.at", 1)])  # finding trips that are due a reminder
    await trips.create_index([("created_at", -1), ("destination.name", 1)])
    await cache.create_index("expires_at", expireAfterSeconds=0)
    await usage.create_index("at", expireAfterSeconds=HOUR)
    await usage.create_index("key")


async def cached(key: str, ttl: int, produce: Callable[[], Awaitable[Any]]) -> Any:
    """Return the cached value for `key`, or produce, store and return it.

    `None` results are not stored, so failed lookups are retried next time.
    """
    doc = await cache.find_one({"_id": key})
    if doc and doc["expires_at"] > now():
        return doc["value"]
    value = await produce()
    if value is not None:
        await cache.replace_one(
            {"_id": key},
            {"value": value, "expires_at": now() + timedelta(seconds=ttl)},
            upsert=True,
        )
    return value


AI_LIMIT_MESSAGE = "You've reached the hourly AI limit. Please try again a little later."


async def enforce_limit(key: str, per_hour: int, message: str = AI_LIMIT_MESSAGE) -> None:
    """Allow at most `per_hour` calls per key in any rolling hour."""
    if await usage.count_documents({"key": key}) >= per_hour:
        raise HTTPException(429, message)
    await usage.insert_one({"key": key, "at": now()})

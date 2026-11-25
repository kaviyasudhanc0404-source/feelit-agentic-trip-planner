"""Order the stops of a day so travellers don't zig-zag across town."""
import math
from itertools import pairwise

from app.services.geo import distance_km

ANCHORS = {"food", "stay", "travel"}  # fixed points of a day; sightseeing is ordered around them
MINUTES_PER_KM = 2  # Indian roads: roughly 30 km/h door to door, including parking
UNKNOWN_HOP_MIN = 15  # a hop between stops we can't place on the map
LATEST = 23 * 60 + 55
CHECK_IN_MIN = 60  # a "stay" stop is checking in, not the whole night, so it only blocks this long


def _located(item: dict | None) -> bool:
    return bool(item) and item.get("lat") is not None


def add_distances(items: list[dict]) -> list[dict]:
    """Set `km_from_prev` (approximate road distance from the previous located stop) on every stop."""
    previous = None
    for item in items:
        item["km_from_prev"] = distance_km(previous, item) if _located(previous) and _located(item) else None
        if _located(item):
            previous = item
    return items


def order_stops(items: list[dict], start: dict) -> list[dict]:
    """Reorder each run of stops between anchors so the nearest one comes next.

    Time slots stay where the planner put them; only which stop fills each slot changes.
    """
    ordered: list[dict] = []
    here, run = start, []

    def flush() -> None:
        nonlocal here
        slots = sorted(item["time"] for item in run)
        pending = list(run)
        run.clear()
        for slot in slots:
            nearest = min(pending, key=lambda p: distance_km(here, p) if _located(p) else float("inf"))
            pending.remove(nearest)
            nearest["time"] = slot
            ordered.append(nearest)
            if _located(nearest):
                here = nearest

    for item in items:
        if item["category"] in ANCHORS:
            flush()
            ordered.append(item)
            if _located(item):
                here = item
        else:
            run.append(item)
    flush()
    return add_distances(ordered)


def minutes(time: str) -> int:
    hours, mins = time.split(":")
    return int(hours) * 60 + int(mins)


def _hop_minutes(previous: dict, item: dict) -> int:
    if _located(previous) and _located(item):
        return max(10, math.ceil(distance_km(previous, item) * MINUTES_PER_KM / 5) * 5)
    return UNKNOWN_HOP_MIN


def retime(items: list[dict]) -> list[dict]:
    """Make the clock realistic: each stop starts after the previous one ends plus the time to get there.

    Planned times are kept when they already allow for that, and journeys never move (trains and buses
    leave on time); any other stop that would start too early moves later, to the next 5 minutes.
    """
    for previous, item in pairwise(items):
        if item["category"] == "travel":
            continue
        busy = previous.get("duration_min", 0)
        if previous["category"] == "stay":
            busy = min(busy, CHECK_IN_MIN)
        earliest = minutes(previous["time"]) + busy + _hop_minutes(previous, item)
        start = min(max(minutes(item["time"]), math.ceil(earliest / 5) * 5), LATEST)
        item["time"] = f"{start // 60:02d}:{start % 60:02d}"
    return items

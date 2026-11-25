"""Manual trip edits from the trip editor: details, dates, budget and every stop."""
from app.db import now
from app.schemas import TripUpdate
from app.services.planner import finish_days

SIMPLE_FIELDS = ("title", "travellers", "style", "budget_limit")
KEPT_ON_STOP = ("lat", "lon", "image")


def _days_from(update: TripUpdate, trip: dict) -> list[dict]:
    """The edited days. A stop that keeps its id and name keeps its map pin and photo; new or renamed stops are looked up again."""
    stored = {item["id"]: item for day in trip["days"] for item in day["items"] if item.get("id")}
    days = []
    for day in update.days or []:
        items = []
        for item in day.model_dump()["items"]:
            old = stored.get(item.get("id") or "")
            if old and old["name"] == item["name"]:
                item.update({key: old.get(key) for key in KEPT_ON_STOP})
            items.append(item)
        days.append({"theme": day.theme, "items": items})
    return days


async def apply_edit(trip: dict, update: TripUpdate) -> dict:
    """Return the changes to store for this edit (the trip document itself is not modified)."""
    sent = update.model_fields_set
    changes: dict = {field: getattr(update, field) for field in SIMPLE_FIELDS if field in sent}
    if "budget" in sent and update.budget:
        changes["budget"] = update.budget.with_total()

    start = update.start_date.isoformat() if update.start_date else trip["start_date"]
    if update.days or start != trip["start_date"]:
        days = _days_from(update, trip) if update.days else [dict(day) for day in trip["days"]]
        changes["days"] = await finish_days(days, {**trip, "start_date": start}, known={}, reorder=False)
        changes["start_date"] = start
        changes["end_date"] = changes["days"][-1]["date"]

    if changes:
        changes["updated_at"] = now()
    return changes

"""Manual trip edits: what is kept, what is looked up again, and how dates move."""
import asyncio

import pytest

from app.schemas import TripUpdate
from app.services import editor, planner

PLACE = {"name": "Kodaikanal", "state": "Tamil Nadu", "label": "Kodaikanal, Tamil Nadu", "lat": 10.23, "lon": 77.49}


def stop(id_, name, time, lat):
    return {"id": id_, "time": time, "name": name, "category": "sight", "description": "", "duration_min": 60,
            "cost_inr": 0, "tip": None, "lat": lat, "lon": 77.49, "image": f"https://img/{id_}.jpg", "km_from_prev": None}


TRIP = {
    "_id": "t1", "start_date": "2026-12-04", "end_date": "2026-12-05", "destination": PLACE,
    "days": [
        {"day": 1, "date": "2026-12-04", "theme": "One", "items": [stop("a", "Lake", "09:00", 10.23), stop("b", "Park", "11:00", 10.24)]},
        {"day": 2, "date": "2026-12-05", "theme": "Two", "items": [stop("c", "Falls", "10:00", 10.25)]},
    ],
}


@pytest.fixture
def looked_up(monkeypatch):
    """Record which stops the editor sends to the (network) map and photo lookup."""
    names: list[str] = []

    async def fake_enrich(items, place, known):
        names.extend(item["name"] for item in items if item.get("lat") is None)

    monkeypatch.setattr(planner, "enrich", fake_enrich)
    return names


def edit(**changes) -> dict:
    return asyncio.run(editor.apply_edit(TRIP, TripUpdate.model_validate(changes)))


def test_moving_the_start_date_shifts_every_day(looked_up):
    changes = edit(start_date="2026-12-10")
    assert (changes["start_date"], changes["end_date"]) == ("2026-12-10", "2026-12-11")
    assert [d["date"] for d in changes["days"]] == ["2026-12-10", "2026-12-11"]
    assert looked_up == []


def test_unchanged_stops_keep_pins_and_renamed_or_new_ones_are_looked_up(looked_up):
    days = [
        {"theme": "Mine", "items": [
            {"id": "a", "name": "Lake", "time": "09:00"},
            {"id": "b", "name": "Rose Garden", "time": "11:00"},
            {"name": "Pillar Rocks", "time": "15:00"},
        ]},
    ]
    changes = edit(days=days, title="Renamed")
    items = changes["days"][0]["items"]
    assert changes["title"] == "Renamed" and len(changes["days"]) == 1 and changes["end_date"] == "2026-12-04"
    assert items[0]["image"] == "https://img/a.jpg" and items[0]["lat"] == 10.23
    assert sorted(looked_up) == ["Pillar Rocks", "Rose Garden"]
    assert all(item["id"] for item in items)


def test_stops_follow_their_times_and_days_are_renumbered(looked_up):
    days = [
        {"theme": "Two first", "items": [{"id": "c", "name": "Falls", "time": "10:00"}]},
        {"theme": "Then one", "items": [{"id": "b", "name": "Park", "time": "08:00"}, {"id": "a", "name": "Lake", "time": "07:30"}]},
    ]
    changes = edit(days=days)
    assert [d["day"] for d in changes["days"]] == [1, 2]
    assert [i["name"] for i in changes["days"][1]["items"]] == ["Lake", "Park"]
    assert changes["days"][1]["items"][1]["km_from_prev"] > 0


def test_an_empty_edit_changes_nothing(looked_up):
    assert edit() == {}

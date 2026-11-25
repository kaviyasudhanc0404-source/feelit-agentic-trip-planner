"""Unit tests for the logic that doesn't need the network or the database."""
from datetime import date

from app.schemas import Brief, Budget, Plan, PlanItem, TripUpdate
from app.security import hash_password, verify_password
from app.services.discover import find_known, known_places
from app.services.geo import distance_km, slug
from app.services.planner import add_journeys, next_saturday
from app.services.route import minutes, order_stops, retime
from app.services.weather import for_dates

CENTRE = {"lat": 10.23, "lon": 77.49}


def stop(name, time, lat=None, category="sight"):
    return {"name": name, "time": time, "category": category, "lat": lat, "lon": 77.49 if lat else None}


def test_password_hash_round_trip():
    hashed = hash_password("secret123")
    assert hashed != "secret123" and verify_password("secret123", hashed) and not verify_password("wrong", hashed)


def test_slug_and_distance():
    assert slug("Coaker’s Walk, Kodaikanal") == "coaker-s-walk-kodaikanal"
    assert distance_km(CENTRE, CENTRE) == 0
    assert 130 < distance_km({"lat": 10.23, "lon": 77.49}, {"lat": 11.23, "lon": 77.49}) < 160  # ~111 km straight line


def test_stops_are_visited_nearest_first_and_keep_time_slots():
    items = [stop("Far", "09:00", 10.40), stop("Near", "10:30", 10.24), stop("Middle", "12:00", 10.30)]
    ordered = order_stops(items, CENTRE)
    assert [i["name"] for i in ordered] == ["Near", "Middle", "Far"]
    assert [i["time"] for i in ordered] == ["09:00", "10:30", "12:00"]
    assert ordered[0]["km_from_prev"] is None and ordered[1]["km_from_prev"] > 0


def test_meals_stay_in_place_and_unlocated_stops_survive():
    items = [stop("B", "09:00", 10.40), stop("Lunch", "13:00", 10.25, "food"), stop("Unknown", "15:00"), stop("A", "16:00", 10.26)]
    ordered = order_stops(items, CENTRE)
    assert [i["name"] for i in ordered] == ["B", "Lunch", "A", "Unknown"]
    assert ordered[3]["km_from_prev"] is None


def test_retime_leaves_room_for_each_visit_and_the_road_but_never_moves_a_journey():
    items = [
        {**stop("Train in", "08:00", category="travel"), "duration_min": 120},
        {**stop("Lake", "09:30", 10.23), "duration_min": 90},  # train arrives 10:00, so this can't start at 09:30
        {**stop("Viewpoint", "13:00", 10.33), "duration_min": 60},  # already late enough: kept
        {**stop("Train home", "13:30", category="travel"), "duration_min": 120},  # trains leave on time
    ]
    assert [i["time"] for i in retime(items)] == ["08:00", "10:15", "13:00", "13:30"]


def test_a_hotel_check_in_does_not_block_the_evening():
    items = [{**stop("Hotel", "16:30", category="stay"), "duration_min": 720}, {**stop("Dinner", "19:30", category="food"), "duration_min": 60}]
    assert [i["time"] for i in retime(items)] == ["16:30", "19:30"]


def test_a_forgotten_return_journey_is_added_after_the_last_stop():
    out = {**stop("Train from Coimbatore to Thrissur", "06:30", category="travel"), "duration_min": 150, "cost_inr": 800}
    dinner = {**stop("Pathans", "20:30", category="food"), "duration_min": 60}
    days = [{"items": [out, dinner]}]
    add_journeys(days, "Coimbatore, Tamil Nadu", None, {"name": "Thrissur"})
    home = days[0]["items"][-1]
    assert (home["name"], home["time"], home["duration_min"]) == ("Train from Thrissur to Coimbatore", "22:00", 150)
    add_journeys(days, "Coimbatore", None, {"name": "Thrissur"})  # already there: nothing added
    add_journeys(days, "Thrissur", None, {"name": "Thrissur"})  # local trip: no journeys
    assert len(days[0]["items"]) == 3


def test_missing_journeys_are_estimated_from_the_distance_and_the_day_moves_to_fit():
    coimbatore, thrissur = {"lat": 11.0, "lon": 76.96}, {"name": "Thrissur", "lat": 10.52, "lon": 76.21}
    lunch = {**stop("Akshaya", "09:00", category="food"), "duration_min": 60}
    days = [{"items": [lunch]}]
    add_journeys(days, "Coimbatore", coimbatore, thrissur, {"mode": "train", "cost_inr": 500})
    there, meal, back = days[0]["items"]
    assert there["name"] == "Train from Coimbatore to Thrissur" and there["cost_inr"] == 500
    assert minutes(meal["time"]) >= minutes(there["time"]) + there["duration_min"]  # no overlap
    assert back["name"] == "Train from Thrissur to Coimbatore" and back["duration_min"] == there["duration_min"]


def test_a_long_missing_journey_becomes_an_overnight_arrival():
    chennai, kodai = {"lat": 13.08, "lon": 80.27}, {"name": "Kodaikanal", "lat": 10.23, "lon": 77.49}
    days = [{"items": [{**stop("Breakfast", "08:30", category="food"), "duration_min": 45}]}]
    add_journeys(days, "Chennai", chennai, kodai, {"mode": "bus"})
    assert days[0]["items"][0]["name"] == "Overnight bus from Chennai to Kodaikanal"
    assert days[0]["items"][1]["time"] == "08:30"


def test_ai_output_is_cleaned_up():
    item = PlanItem(name="Lake", time="9:5", category="boating", cost_inr="150.6", duration_min=None)
    assert (item.time, item.category, item.cost_inr, item.duration_min) == ("09:00", "sight", 151, 0)
    assert PlanItem(name="Lake", time="7:30 AM").time == "07:30"
    assert Budget(stay="1000", food=None, transport=250.4).with_total()["total"] == 1250
    plan = Plan.model_validate({"title": "T", "days": [{"day": 1, "items": [{"name": "X"}]}], "stay": None})
    assert plan.days[0].items[0].category == "sight" and plan.budget.with_total()["total"] == 0


def test_brief_coerces_ai_and_form_values():
    brief = Brief.model_validate({
        "destination": "null", "days": "0", "travellers": 40, "style": "fancy", "group": "team",
        "pace": "slow", "start_date": "soon", "budget_inr": "₹20,000", "food_pref": "veg",
    })
    assert (brief.destination, brief.days, brief.travellers, brief.style, brief.group, brief.pace) == (None, 1, 20, "comfort", "couple", "balanced")
    assert (brief.start_date, brief.budget_inr, brief.food_pref) == (None, 20000, "veg")
    assert Brief.model_validate({"start_date": "2026-12-25T00:00:00", "days": 30}).days == 10
    assert Brief.model_validate({"start_date": "2026-12-25"}).start_date == date(2026, 12, 25)


def test_trip_update_only_tracks_sent_fields():
    update = TripUpdate.model_validate({"title": "New name", "days": [{"theme": "x", "items": [{"name": "Lake", "time": "4:30 pm"}]}]})
    assert update.model_fields_set == {"title", "days"}
    assert update.days[0].items[0].time == "16:30"


def test_next_saturday_is_always_in_the_future():
    assert next_saturday(date(2026, 11, 15)) == date(2026, 11, 21)  # Sunday -> coming Saturday
    assert next_saturday(date(2026, 11, 21)) == date(2026, 11, 28)  # Saturday -> next week's


def test_forecast_rows_filtered_by_date():
    weather = {"daily": [{"date": "2026-11-21"}, {"date": "2026-11-22"}]}
    assert for_dates(weather, ["2026-11-22", "2026-12-01"]) == [{"date": "2026-11-22"}]
    assert for_dates(None, ["2026-11-22"]) == []


def test_known_places_match_by_name_but_never_by_empty_key():
    park = {"name": "Bryant Park", "lat": 10.23, "lon": 77.49}
    known = known_places([park, {"name": "பூங்கா", "lat": 1.0, "lon": 1.0}, {"name": "No coords"}])
    assert list(known) == ["bryant-park"]
    assert find_known("Bryant Park", known) is park
    assert find_known("Bryant Park Kodaikanal", known) is park
    assert find_known("Café des Arts", known) is None and find_known("Park", known) is None

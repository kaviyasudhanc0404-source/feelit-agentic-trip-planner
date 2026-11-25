"""The trip builder: a confirmed brief in, a real day-by-day trip out."""
import asyncio
import json
import math
import secrets
from datetime import date, timedelta
from typing import AsyncIterator

from pydantic import ValidationError

from app.db import now, trips
from app.schemas import Brief, Plan, PlanDay
from app.services import geo, weather
from app.services.discover import SEARCH_RADIUS_KM, destination_guide, enrich, known_places
from app.services.llm import AIUnavailable, ask_json
from app.services.route import add_distances, minutes, order_stops, retime
from app.services.search import as_text, web_search

PACE_STOPS = {"relaxed": "4-5", "balanced": "5-7", "packed": "7-9"}  # places per day, not counting travel

PLAN_SYSTEM = """You are Feel It, an expert trip planner for India. Plan a realistic day-by-day trip as one JSON object.

Rules:
- Use real places from the DESTINATION GUIDE and MAP LIST. Never invent places, restaurants or hotels.
- "name" is ONLY the exact name of the place as written in the guide or map list, e.g. "Bryant Park" or "Ten Degrees".
  Never add words like "Lunch at", "Visit", "Check-in" or notes in brackets; say those in "description".
  The only exception is a travel stop, whose name is the whole journey, e.g. "Train from Chennai to Kodaikanal"
  (never a single word like "road" or "train").
- Fill every day: use the stops_per_day given in BRIEF (places, not counting travel stops), including breakfast, lunch
  and dinner (or snacks) at named food places that match the food preference. Cover every interest and honour the notes:
  they are the traveller's wishes and come first. Prefer the trending places, then hidden gems.
- Put places that are close to each other on the same day, in a sensible route.
- Real timings: times are 24-hour "HH:MM". Each stop starts after the previous one ends ("duration_min") plus the time to
  get there. A "stay" stop is the hotel check-in (duration_min 30-60), never the whole night. Respect usual opening hours (many temples close about 12:30-16:00, sunrise and sunset points at the right
  time, markets in the evening). Meals at normal Indian times: breakfast 08:00-09:30, lunch 13:00-14:30, dinner 19:30-21:00.
- Journeys, when ORIGIN is another city: day 1 starts with the outbound travel stop from ORIGIN, and the LAST day ends with
  the return travel stop back to ORIGIN (e.g. "Train from Kodaikanal to Chennai") at a realistic departure time, with
  its real duration. A 1-day trip has both: outbound first, return last. "getting_there" describes the outbound journey;
  "budget.transport" includes both directions and local travel.
  If ORIGIN is "not given" or is the destination itself, "getting_there" is null and there are no outbound or return stops.
- Follow the WEATHER: on rainy days prefer indoor or covered stops and say so in the tip.
- Match the style (budget, comfort or luxury), group, pace and interests.
- All costs are approximate Indian rupees for the WHOLE group. Keep the total within budget_inr if one is given.
  "budget.activities" is entry fees and activity costs; "budget.misc" covers shopping and local extras.
- "events": festivals, fairs or special events from the EVENTS sources that fall on or near the trip dates; [] if none.
- For a 1-day trip, "stay" is null. Descriptions max 20 words; tips max 14 words or null.

JSON shape:
{"title": "max 6 words", "summary": "2 sentences on the feel of this trip",
 "days": [{"day": 1, "theme": "max 5 words", "items": [{"time": "09:00", "name": "", "category": "sight|food|shopping|activity|travel|stay", "description": "", "duration_min": 90, "cost_inr": 0, "tip": null}]}],
 "stay": {"name": "", "area": "", "price_per_night_inr": 0, "why": "max 14 words"},
 "getting_there": {"mode": "train|flight|bus|car", "detail": "best way from the origin with typical time", "cost_inr": 0},
 "budget": {"stay": 0, "food": 0, "transport": 0, "activities": 0, "misc": 0},
 "events": [{"name": "", "when": "date or dates", "detail": "max 18 words"}],
 "packing": ["6-8 items suited to the weather and place"], "tips": ["4-5 short local tips, one about saving money"]}"""


def next_saturday(today: date) -> date:
    return today + timedelta(days=(5 - today.weekday()) % 7 or 7)


def guide_brief(guide: dict, style: str) -> str:
    """The parts of a destination guide the planner and assistant need, as compact JSON."""
    return json.dumps(
        {
            "trending": [{k: t.get(k) for k in ("name", "why", "kind", "entry_fee_inr", "hours_needed")} for t in guide.get("trending", [])],
            "food": guide.get("food", []),
            "shopping": guide.get("shopping", []),
            "stays": (guide.get("stays") or {}).get(style, []),
            "getting_there": guide.get("getting_there", []),
            "best_time": guide.get("best_time"),
        },
        ensure_ascii=False,
    )


def weather_text(forecast: dict | None, dates: list[str]) -> str:
    rows = weather.for_dates(forecast, dates)
    return "; ".join(f"{d['date']}: {d['label']}, {d['min']}-{d['max']}°C, rain {d['rain']}%" for d in rows) or (
        "No forecast yet for these dates (forecasts cover the next 16 days); plan for the usual season."
    )


async def finish_days(days: list[dict], trip: dict, known: dict[str, dict], reorder: bool = True) -> list[dict]:
    """Number the days, give them dates, coordinates, photos and distances.

    `reorder` lets the route optimiser choose which stop fills each time slot and makes the clock realistic
    (used for AI-written days); manual edits keep the traveller's own order and times.
    """
    start = date.fromisoformat(trip["start_date"])
    await enrich([item for day in days for item in day["items"]], trip["destination"], known)
    for number, day in enumerate(days, start=1):
        day["day"] = number
        day["date"] = (start + timedelta(days=number - 1)).isoformat()
        stops = sorted(day["items"], key=lambda i: i["time"])
        day["items"] = retime(order_stops(stops, trip["destination"])) if reorder else add_distances(stops)
        for item in day["items"]:
            item["id"] = item.get("id") or secrets.token_hex(4)
    return days


MODES = {"train": "Train", "flight": "Flight", "bus": "Bus", "car": "Drive"}
OVERNIGHT_MIN = 6 * 60


def _journey(name: str, start: int, length: int, cost: int, text: str) -> dict:
    return {"id": secrets.token_hex(4), "time": f"{start // 60:02d}:{start % 60:02d}", "name": name, "category": "travel",
            "description": text, "duration_min": length, "cost_inr": cost, "tip": None, "km_from_prev": None}


def add_journeys(days: list[dict], origin: str | None, origin_place: dict | None, destination: dict, way: dict | None = None) -> None:
    """Make sure a trip from another city starts with the journey there and ends with the journey home.

    The AI sometimes leaves them out. A missing journey copies the other one's mode, length and fare,
    or is estimated from the road distance between the two places.
    """
    home = (origin or "").split(",")[0].strip()
    if not home or not days or geo.slug(home) == geo.slug(destination["name"]):
        return
    known = next((i for d in days for i in d["items"] if i["category"] == "travel"), None)
    if known:
        kind, length, fare = known["name"].split()[0].capitalize(), known["duration_min"], known["cost_inr"]
    else:
        kind = MODES.get(str((way or {}).get("mode", "")).lower().strip(), "Drive")
        km = geo.distance_km(origin_place, destination) if origin_place else 120
        length = 180 if kind == "Flight" else max(30, math.ceil(km * 1.2 / 15) * 15)  # ~50 km/h door to door
        fare = (way or {}).get("cost_inr") or 0

    first = days[0]["items"]
    if not first or first[0]["category"] != "travel":
        arrive = minutes(first[0]["time"]) - 30 if first else 9 * 60
        if length > OVERNIGHT_MIN:  # a long journey runs overnight: show the arrival in the morning
            stop = _journey(f"Overnight {kind.lower()} from {home} to {destination['name']}", max(arrive - 30, 5 * 60), 30, fare,
                            f"Leave {home} the evening before; about {round(length / 60)} hours on the way.")
        else:
            stop = _journey(f"{kind} from {home} to {destination['name']}", max(4 * 60, (arrive - length) // 15 * 15), length, fare,
                            f"Set off for {destination['name']}.")
        first.insert(0, stop)
        retime(first)  # later stops move if the journey arrives later than the AI planned

    last = days[-1]["items"]
    if last[-1]["category"] != "travel":
        end = minutes(last[-1]["time"]) + last[-1].get("duration_min", 0) + 30
        last.append(_journey(f"{kind} from {destination['name']} to {home}", min(math.ceil(end / 15) * 15, 23 * 60 + 45), length, fare, "Head back home."))


def as_dicts(days: list[PlanDay]) -> list[dict]:
    return [day.model_dump() for day in days]


async def plan_trip(brief: Brief, user: dict) -> AsyncIterator[dict]:
    """Build and save a trip from a confirmed brief, yielding progress events for the live screen."""
    try:
        if brief.destination:
            yield {"step": f"Locating {brief.destination}"}
            place = await geo.geocode(brief.destination)
            if not place:
                yield {"error": f"I couldn't find “{brief.destination}” in India. Try a nearby town or city."}
                return
        elif brief.lat is not None and brief.lon is not None:
            yield {"step": "Finding where you are"}
            place = await geo.reverse(brief.lat, brief.lon)
            if not place:
                yield {"error": "Feel It plans trips inside India. Tell me which place you'd like to visit."}
                return
            brief.origin = brief.origin or place["name"]
        else:
            yield {"error": "Tell me which place in India you'd like to visit."}
            return

        today = date.today()
        start = brief.start_date if brief.start_date and brief.start_date >= today else next_saturday(today)
        dates = [(start + timedelta(days=i)).isoformat() for i in range(brief.days)]

        yield {"step": f"Reading what's trending in {place['name']} right now"}
        guide, forecast, mapped, events = await asyncio.gather(
            destination_guide(place),
            weather.forecast(place["lat"], place["lon"]),
            geo.places(place, SEARCH_RADIUS_KM),
            web_search(f"festivals and events in {place['name']} {place['state']} {start:%B %Y}", 4),
        )

        yield {"step": "Checking the weather for your dates"}
        details = brief.model_dump(mode="json", exclude={"destination", "origin", "lat", "lon", "start_date"})
        details["stops_per_day"] = PACE_STOPS[brief.pace]

        yield {"step": f"Designing your {brief.days}-day itinerary"}
        prompt = (
            f"BRIEF\n{json.dumps(details, ensure_ascii=False)}\nORIGIN: {brief.origin or 'not given'}\n"
            f"Destination: {place['label']}\nDates: {dates[0]} to {dates[-1]}\n\n"
            f"WEATHER\n{weather_text(forecast, dates)}\n\nEVENTS\n{as_text(events)}\n\n"
            f"DESTINATION GUIDE\n{guide_brief(guide, brief.style)}\n\nMAP LIST\n{', '.join(p['name'] for p in mapped[:60])}"
        )
        plan = None
        for attempt in range(2):  # one retry when the AI returns fewer days than asked (or broken JSON)
            if attempt:
                yield {"step": "Filling in the remaining days"}
                prompt += f'\n\nIMPORTANT: "days" must contain exactly {brief.days} days.'
            try:
                plan = Plan.model_validate(await ask_json(PLAN_SYSTEM, prompt, tier="big", max_tokens=min(2500 + 1200 * brief.days, 14000)))
            except ValidationError:
                continue
            if len(plan.days) >= brief.days:
                break
        if not plan:
            raise AIUnavailable("The AI returned an incomplete plan. Please try again.")
        origin_place = await geo.geocode(brief.origin) if brief.origin else None

        yield {"step": "Pinning places on the map and adding photos"}
        trip = {
            "_id": secrets.token_urlsafe(9),
            "user_id": user["_id"],
            "title": plan.title,
            "summary": plan.summary,
            "brief": brief.model_dump(mode="json", exclude={"lat", "lon"}),
            "destination": place,
            "origin": brief.origin,
            "start_date": dates[0],
            "end_date": dates[-1],
            "travellers": brief.travellers,
            "group": brief.group,
            "style": brief.style,
            "budget_limit": brief.budget_inr or None,
            "stay": plan.stay.model_dump() if plan.stay and brief.days > 1 else None,
            "getting_there": plan.getting_there.model_dump() if plan.getting_there else None,
            "budget": plan.budget.with_total(),
            "events": [e.model_dump() for e in plan.events[:5]],
            "packing": plan.packing[:10],
            "tips": plan.tips[:6],
            "cover": guide.get("cover"),
            "chat": [],
            "is_public": False,
            "created_at": now(),
            "updated_at": now(),
        }
        trip["days"] = await finish_days(as_dicts(plan.days[: brief.days]), trip, known_places(guide["trending"], mapped))
        add_journeys(trip["days"], brief.origin, origin_place, place, trip["getting_there"])
        trip["end_date"] = trip["days"][-1]["date"]
        await trips.insert_one(trip)
        yield {"trip_id": trip["_id"]}
    except AIUnavailable as error:
        yield {"error": str(error)}

"""Live discovery: destination guides, trending destinations and places near the user."""
import asyncio
from datetime import date, timedelta

from app.db import DAY, HOUR, cached, now, trips
from app.services import geo
from app.services.llm import ask_json
from app.services.photos import cover_photo, place_photo
from app.services.search import as_text, web_search

SEARCH_RADIUS_KM = 30
PHOTO_KINDS = {"sight", "activity"}

GUIDE_SYSTEM = """You are Feel It, a travel expert for India. Write a destination guide as one JSON object.

Use ONLY the web sources in the message. Never invent a place, restaurant, shop or hotel: every name must
appear in the sources. Choose "trending" from the PLACES & TRENDING sources, ranked by how many sources
recommend a place and how strongly: famous must-sees first, then what they call trending, viral, popular
with travel creators, or a hidden gem. The MAP LIST is only there to confirm spellings; never pick a place
just because it is on the map list. Prices are approximate Indian rupees taken from the sources;
use null when the sources give no price.

JSON shape:
{"tagline": "max 10 words", "about": "2 sentences", "best_time": "months and why, 1 sentence", "ideal_days": 3,
 "trending": [{"name": "", "why": "max 20 words", "kind": "viewpoint|nature|heritage|temple|beach|activity|market|museum", "entry_fee_inr": 0, "hours_needed": 1.5}],
 "food": [{"name": "", "known_for": "", "area": "", "cost_for_two_inr": 0}],
 "shopping": [{"name": "", "buy": "what to buy", "area": ""}],
 "stays": {"budget": [{"name": "", "area": "", "price_per_night_inr": 0}], "comfort": [], "luxury": []},
 "getting_there": [{"mode": "train|flight|bus|road", "detail": "nearest station or airport and typical time"}],
 "tips": ["5 short practical tips, include one money-saving tip"]}
Give 10-14 trending, 8-10 food, 4-5 shopping and 2-3 stays per tier."""

TRENDING_SYSTEM = """From the web sources, pick 8 destinations in India that are trending for travel right now.
Return JSON: {"destinations": [{"name": "town or city", "state": "", "why": "max 14 words", "best_for": "couples|family|friends|solo|everyone", "ideal_days": 3}]}
Only real places named in the sources. "name" is a town, city or region people travel to (not a single
beach, temple or attraction) and "state" is its correct Indian state or union territory.
Mix hills, beaches, heritage and offbeat places."""


def known_places(*groups: list[dict]) -> dict[str, dict]:
    """Index already-located places by name so they are not geocoded again.

    Names with no Latin letters (e.g. written only in Tamil script) have an empty key and are left out.
    """
    return {geo.slug(p["name"]): p for group in groups for p in group if p.get("lat") is not None and geo.slug(p["name"])}


def find_known(name: str, known: dict[str, dict]) -> dict | None:
    """Exact name match, else a known place whose name contains this one or the reverse ("Bryant Park" ~ "Bryant Park Kodaikanal")."""
    key = geo.slug(name)
    if key in known:
        return known[key]
    return next((p for k, p in known.items() if min(len(k), len(key)) >= 6 and (key in k or k in key)), None)


async def enrich(items: list[dict], place: dict, known: dict[str, dict]) -> None:
    """Add real coordinates (and a photo for sights) to each item, in place."""
    async def one(item: dict) -> None:
        if item.get("lat") is None and item.get("category") != "travel":  # a journey is not a point on the map
            match = find_known(item["name"], known) or await geo.locate_spot(item["name"], place)
            if match:
                item["lat"], item["lon"] = match["lat"], match["lon"]
                item.setdefault("image", match.get("image"))
        if not item.get("image") and item.get("category", "sight") in PHOTO_KINDS:
            item["image"] = (await place_photo(item["name"], place["name"]))["url"]

    await asyncio.gather(*(one(item) for item in items))


async def destination_guide(place: dict) -> dict:
    """Everything worth knowing about a destination (a geocoded place), built from live web and map data."""
    async def build():
        where = f"{place['name']}, {place['state']}"
        sights, eats, stays, mapped = await asyncio.gather(
            web_search(f"trending must visit places and hidden gems in {where} {date.today().year}"),
            web_search(f"best local food famous restaurants cafes and shopping markets in {where}"),
            web_search(f"best hotels resorts homestays in {where} budget to luxury price per night and how to reach"),
            geo.places(place, SEARCH_RADIUS_KM),
        )
        guide = await ask_json(
            GUIDE_SYSTEM,
            f"Destination: {where}\n\nPLACES & TRENDING\n{as_text(sights)}\n\nFOOD & SHOPPING\n{as_text(eats)}\n\n"
            f"STAYS & TRAVEL\n{as_text(stays)}\n\nMAP LIST\n{', '.join(p['name'] for p in mapped)}",
            tier="big",
            max_tokens=5000,
        )
        # Keep only well-formed entries: the AI occasionally returns blank rows.
        def rows(key: str, required: str) -> list[dict]:
            return [r for r in guide.get(key) or [] if isinstance(r, dict) and r.get(required)]

        trending = rows("trending", "name")
        guide.update(food=rows("food", "name"), shopping=rows("shopping", "name"), getting_there=rows("getting_there", "detail"))
        cover, _ = await asyncio.gather(cover_photo(place["name"], place["state"]), enrich(trending, place, known_places(mapped)))
        return {**guide, "trending": trending, "place": place, "cover": cover}

    return await cached(f"guide:{geo.slug(place['label'])}", 7 * DAY, build)


async def _with_cover(destination: dict) -> dict | None:
    """Add a cover photo; drops destinations that can't be found in India."""
    if not await geo.geocode(f"{destination['name']}, {destination.get('state') or 'India'}"):
        return None
    return {**destination, "cover": await cover_photo(destination["name"], destination.get("state"))}


async def trending() -> dict:
    """Trending now: from the live web, and from what Feel It travellers planned this month."""
    async def from_web():
        results = await web_search(f"trending travel destinations in India to visit in {date.today():%B %Y}", 6)
        if not results:
            return None
        picks = (await ask_json(TRENDING_SYSTEM, as_text(results), tier="big", max_tokens=1500)).get("destinations", [])
        found = await asyncio.gather(*(_with_cover(p) for p in picks[:8] if isinstance(p, dict) and p.get("name")))
        return [f for f in found if f] or None

    async def from_travellers():
        rows = await trips.aggregate([
            {"$match": {"created_at": {"$gte": now() - timedelta(days=30)}}},
            {"$group": {"_id": "$destination.label", "name": {"$first": "$destination.name"}, "state": {"$first": "$destination.state"}, "trips": {"$sum": 1}}},
            {"$sort": {"trips": -1}},
            {"$limit": 6},
        ])
        found = await asyncio.gather(
            *(_with_cover({"name": r["name"], "state": r["state"], "trips": r["trips"]}) for r in await rows.to_list() if r["name"])
        )
        return [f for f in found if f]

    web, travellers = await asyncio.gather(cached("trending:web", DAY, from_web), cached("trending:travellers", HOUR // 6, from_travellers))
    return {"web": web or [], "travellers": travellers or []}


async def nearby(lat: float, lon: float) -> dict | None:
    """What's worth visiting around the user: the live guide for where they are, with distances."""
    here = await geo.reverse(lat, lon)
    if not here:
        return None
    guide = await destination_guide(here)
    me = {"lat": lat, "lon": lon}
    spots = [{**t, "km": geo.distance_km(me, t) if t.get("lat") is not None else None} for t in guide["trending"]]
    return {"here": here, "places": sorted(spots, key=lambda s: s["km"] if s["km"] is not None else 1e9)}

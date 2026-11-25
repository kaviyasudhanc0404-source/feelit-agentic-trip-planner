"""Real place data for India from Geoapify (OpenStreetMap)."""
import math
import re

from app.config import settings
from app.db import DAY, cached
from app.services.http import get_json

BASE = "https://api.geoapify.com"
INDIA = "countrycode:in"
SIGHTS = "tourism,natural,beach,leisure.park,entertainment.museum,entertainment.zoo,heritage"
ROAD_FACTOR = 1.3  # straight-line distance -> rough road distance


def slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def distance_km(a: dict, b: dict) -> float:
    """Approximate road distance between two {lat, lon} points."""
    lat1, lon1, lat2, lon2 = map(math.radians, (a["lat"], a["lon"], b["lat"], b["lon"]))
    h = math.sin((lat2 - lat1) / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2
    return round(2 * 6371 * math.asin(math.sqrt(h)) * ROAD_FACTOR, 1)


def _place(r: dict) -> dict:
    name = r.get("name") or r.get("city") or r.get("county") or r.get("address_line1", "")
    return {
        "name": name,
        "state": r.get("state"),
        "label": ", ".join(p for p in dict.fromkeys([name, r.get("state_district"), r.get("state")]) if p),
        "lat": r["lat"],
        "lon": r["lon"],
        # True when the geocoder matched the name itself, not just the street or town it guessed from.
        "exact": (r.get("rank") or {}).get("match_type") in ("full_match", "inner_part")
        and (r.get("rank") or {}).get("confidence", 0) >= 0.5,
    }


async def _geocoder(path: str, **params) -> list[dict]:
    data = await get_json(f"{BASE}/v1/geocode/{path}", params={**params, "format": "json", "apiKey": settings.geoapify_api_key})
    return [_place(r) for r in (data or {}).get("results", []) if r.get("lat") is not None]


async def autocomplete(text: str) -> list[dict]:
    return await _geocoder("autocomplete", text=text, filter=INDIA, limit=6, type="city")


async def geocode(text: str) -> dict | None:
    """Find a town, city or region in India by name."""
    async def lookup():
        # Prefer the city itself: a bare name like "Puducherry" otherwise resolves to the middle of the whole territory.
        for kind in ({"type": "city"}, {}):
            results = await _geocoder("search", text=text, filter=INDIA, limit=1, **kind)
            if results:
                return results[0]
        return None

    return await cached(f"town:{slug(text)}", 30 * DAY, lookup)


async def locate_spot(name: str, town: dict, max_km: int = 90) -> dict | None:
    """Coordinates of one named spot in or around a town; None unless the match is exact and nearby."""
    async def lookup():
        results = await _geocoder(
            "search", text=f"{name}, {town['name']}, {town['state']}", filter=INDIA, limit=1, bias=f"proximity:{town['lon']},{town['lat']}"
        )
        hit = results[0] if results else None
        named = hit and (hit["exact"] or slug(hit["name"]) == slug(name))
        found = bool(named and slug(hit["name"]) != slug(town["name"]) and distance_km(town, hit) <= max_km)
        return {"lat": hit["lat"], "lon": hit["lon"]} if found else {}  # {} caches "not found" too

    return await cached(f"spot:{slug(name)}:{slug(town['label'])}", 30 * DAY, lookup) or None


async def reverse(lat: float, lon: float) -> dict | None:
    async def lookup():
        data = await get_json(
            f"{BASE}/v1/geocode/reverse",
            params={"lat": lat, "lon": lon, "format": "json", "apiKey": settings.geoapify_api_key},
        )
        results = (data or {}).get("results", [])
        if not results or results[0].get("country_code") != "in":
            return None
        r = results[0]
        name = r.get("city") or r.get("county") or r.get("state_district")
        return {"name": name, "state": r.get("state"), "label": f"{name}, {r.get('state')}", "lat": lat, "lon": lon}

    return await cached(f"rev:{lat:.2f},{lon:.2f}", 30 * DAY, lookup)


async def places(center: dict, radius_km: int, categories: str = SIGHTS, limit: int = 40) -> list[dict]:
    """Named real-world places around a point, nearest first."""
    async def lookup():
        point = f"{center['lon']},{center['lat']}"
        data = await get_json(
            f"{BASE}/v2/places",
            params={
                "categories": categories,
                "filter": f"circle:{point},{radius_km * 1000}",
                "bias": f"proximity:{point}",
                "limit": limit,
                "apiKey": settings.geoapify_api_key,
            },
        )
        if data is None:
            return None
        found, seen = [], set()
        for feature in data.get("features", []):
            p = feature["properties"]
            name = p.get("name")
            if not name or slug(name) in seen:
                continue
            seen.add(slug(name))
            kinds = [c.split(".")[-1] for c in p.get("categories", []) if not c.startswith(("building", "wheelchair", "fee", "access", "internet"))]
            found.append({"name": name, "kind": kinds[-1] if kinds else "place", "lat": p["lat"], "lon": p["lon"]})
        return found

    key = f"places:{center['lat']:.2f},{center['lon']:.2f}:{radius_km}:{slug(categories)[:40]}:{limit}"
    return await cached(key, 7 * DAY, lookup) or []

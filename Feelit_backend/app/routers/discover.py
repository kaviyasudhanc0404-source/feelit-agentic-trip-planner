from fastapi import APIRouter, Depends, HTTPException, Query

from app.security import ai_limit
from app.services import discover, geo, weather
from app.services.llm import AIUnavailable

router = APIRouter(prefix="/discover", tags=["discover"])
Lat = Query(ge=-90, le=90)
Lon = Query(ge=-180, le=180)


@router.get("/autocomplete")
async def autocomplete(q: str = Query(min_length=2, max_length=60)):
    return await geo.autocomplete(q)


@router.get("/trending")
async def trending():
    try:
        return await discover.trending()
    except AIUnavailable:
        return {"web": [], "travellers": []}


@router.get("/nearby", dependencies=[Depends(ai_limit)])
async def nearby(lat: float = Lat, lon: float = Lon):
    try:
        result = await discover.nearby(lat, lon)
    except AIUnavailable as error:
        raise HTTPException(503, str(error)) from None
    if not result:
        raise HTTPException(404, "Feel It works for locations inside India.")
    return result


@router.get("/guide", dependencies=[Depends(ai_limit)])
async def guide(place: str = Query(min_length=2, max_length=80)):
    found = await geo.geocode(place)
    if not found:
        raise HTTPException(404, f"I couldn't find “{place}” in India.")
    try:
        return await discover.destination_guide(found)
    except AIUnavailable as error:
        raise HTTPException(503, str(error)) from None


@router.get("/weather")
async def get_weather(lat: float = Lat, lon: float = Lon):
    result = await weather.forecast(lat, lon)
    if not result:
        raise HTTPException(503, "Weather is unavailable right now.")
    return result

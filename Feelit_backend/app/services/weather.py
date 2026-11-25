"""Live weather and air quality from Open-Meteo (no API key)."""
import asyncio

from app.db import HOUR, cached
from app.services.http import get_json

WMO = {
    0: "Clear", 1: "Mostly clear", 2: "Partly cloudy", 3: "Cloudy", 45: "Fog", 48: "Fog",
    51: "Light drizzle", 53: "Drizzle", 55: "Heavy drizzle", 61: "Light rain", 63: "Rain", 65: "Heavy rain",
    71: "Light snow", 73: "Snow", 75: "Heavy snow", 77: "Snow", 80: "Showers", 81: "Showers", 82: "Heavy showers",
    85: "Snow showers", 86: "Snow showers", 95: "Thunderstorm", 96: "Thunderstorm", 99: "Thunderstorm",
}


async def forecast(lat: float, lon: float) -> dict | None:
    """Current conditions plus a 16-day daily forecast for a point."""
    async def lookup():
        point = {"latitude": lat, "longitude": lon, "timezone": "Asia/Kolkata"}
        weather, air = await asyncio.gather(
            get_json(
                "https://api.open-meteo.com/v1/forecast",
                params={
                    **point,
                    "forecast_days": 16,
                    "current": "temperature_2m,weather_code",
                    "daily": "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
                },
            ),
            get_json("https://air-quality-api.open-meteo.com/v1/air-quality", params={**point, "current": "us_aqi"}),
        )
        if not weather:
            return None
        daily, current = weather["daily"], weather["current"]
        return {
            "current": {
                "temp": round(current["temperature_2m"]),
                "code": current["weather_code"],
                "label": WMO.get(current["weather_code"], "—"),
                "aqi": (air or {}).get("current", {}).get("us_aqi"),
            },
            "daily": [
                {
                    "date": date,
                    "code": daily["weather_code"][i],
                    "label": WMO.get(daily["weather_code"][i], "—"),
                    "max": round(daily["temperature_2m_max"][i]),
                    "min": round(daily["temperature_2m_min"][i]),
                    "rain": daily["precipitation_probability_max"][i] or 0,
                }
                for i, date in enumerate(daily["time"])
                if daily["temperature_2m_max"][i] is not None
            ],
        }

    return await cached(f"weather:{lat:.2f},{lon:.2f}", HOUR, lookup)


def for_dates(weather: dict | None, dates: list[str]) -> list[dict]:
    """The forecast rows that fall on the given ISO dates (empty if out of range)."""
    return [d for d in (weather or {}).get("daily", []) if d["date"] in dates]

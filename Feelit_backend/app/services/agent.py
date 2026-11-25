"""The Feel It agent: a tool-using travel planner that talks like a human one.

One loop serves two places:
  converse()     - the planning chat: answers anything, asks the right questions, then hands over a trip brief
  assist_trip()  - the assistant inside a saved trip: answers, and edits days or the budget on request
Both stream {"step": ...} events while tools run, then one final event.
"""
import json
from datetime import date
from typing import AsyncIterator

from pydantic import ValidationError

from app.db import now, trips
from app.schemas import AgentAnswer, Brief, TripAnswer
from app.services import geo, weather
from app.services.discover import destination_guide, known_places
from app.services.llm import AIUnavailable, ask_json
from app.services.planner import finish_days, guide_brief, next_saturday, weather_text
from app.services.route import retime
from app.services.search import as_text, web_search

MAX_TOOL_CALLS = 3
TRIP_HISTORY_KEPT = 30
SPOT_FIELDS = ("name", "why", "kind", "image", "entry_fee_inr", "hours_needed", "lat", "lon")

TOOLS = """Each turn, reply with ONE JSON object. To use a tool:
{"tool": "search", "query": "..."}     fresh facts from the web: prices, timings, events, rules, closures, news
{"tool": "weather", "place": "Town, State"}   live 16-day forecast and air quality
{"tool": "places", "place": "Town, State"}    trending places, food, shopping and stays (takes a while for a new place)
Use at most 3 tools per turn and never repeat the same call. Use tools for anything that changes over time."""

PLANNER_SYSTEM = f"""You are Feel It, an agentic AI travel planner for India: warm, sharp and concise, like the best human trip planner.

{TOOLS}

When you are ready to answer, reply with:
{{"reply": "...", "questions": [], "brief": null, "suggestions": [], "show_places": null}}

PLANNING A TRIP
1. When the traveller wants a trip, first ask what you still need, all in ONE round of "questions" (2-6 questions).
   Essentials: destination, starting city, dates or month, number of days, who is travelling, total budget,
   food preference, pace, interests. Skip what they already said or what the PROFILE answers (but confirm dates
   and budget if missing). Each question: {{"id": "budget", "label": "What's your total budget for the trip?",
   "options": ["Under ₹10,000", "₹10,000 – ₹25,000", "₹25,000 – ₹50,000", "No fixed budget"], "multi": false}}
   Options are short tappable answers (2-6); "multi": true when several can apply (interests). They can also type.
   If they ask for ideas without a destination, suggest 3-4 fitting places in "reply" and ask which one appeals.
2. Once you know enough, or they say "just plan it" (then use sensible defaults), return "brief" with every field:
   {{"destination": "Town, State", "origin": "city or null", "start_date": "YYYY-MM-DD", "days": 3, "travellers": 2,
    "group": "solo|couple|family|friends", "style": "budget|comfort|luxury", "budget_inr": 20000 or null,
    "food_pref": "any|veg|nonveg|vegan|jain", "pace": "relaxed|balanced|packed", "interests": ["nature", "food"],
    "notes": "other wishes"}}
   Before giving a brief, call the weather tool for the destination and mention what to expect for their dates.
   Keep "reply" short, e.g. "Here's your trip brief. Check it, change anything, then tap Build my trip."
   Never write the day-by-day itinerary yourself; the app builds it from the brief.

ANY OTHER QUESTION (what to see, best time, how to get there, costs, weather, safety, packing, food, festivals):
answer directly and usefully in at most 120 words. Set "show_places" to a destination name ("Town, State") when
showing its top places would help, else null.

RULES: India only; politely decline trips abroad. Never invent places, prices or facts, and say when a number is an
estimate. Resolve dates like "next weekend" from TODAY; dates are never in the past. "suggestions": 2-4 short
follow-ups the traveller might tap, written as things they would say (never "Build my trip": the app shows that button). "reply" is plain text; short "- " bullet lines are fine; no markdown headings."""

TRIP_SYSTEM = f"""You are the Feel It assistant inside one saved trip in India. Answer questions about the trip and the
destination, and change the plan when asked.

{TOOLS}

When you are ready to answer, reply with:
{{"reply": "max 90 words", "days": [], "budget": null, "suggestions": []}}
"days": the FULL updated day objects for only the days you changed, in the same shape as TRIP days
(day, theme, items with time, name, category, description, duration_min, cost_inr, tip). Empty if nothing changed.
"budget": the full updated budget object if costs changed, else null.

RULES: use real places from the DESTINATION GUIDE, the trip or tool results; never invent places. Keep unchanged stops
exactly as they are. Times are 24-hour "HH:MM" and realistic: each stop starts after the previous one ends plus travel
time, meals at normal Indian times, and the last day keeps its return journey home. When asked for more places, add
real ones close to the day's route. Costs are rupees for the whole group. Respect the WEATHER.
"suggestions": 2-3 short follow-ups."""


def _profile(user: dict | None) -> str:
    if not user:
        return "Guest (not signed in); no profile."
    return (
        f"Name: {user['name']}. Home city: {user.get('home_city') or 'unknown'}. "
        f"Usual style: {user.get('style', 'comfort')}. Food preference: {user.get('food_pref', 'any')}."
    )


async def _run_tool(call: dict, style: str, seen: dict) -> tuple[str, str]:
    """Run one tool call; returns (progress label, result text). Records sources and guides in `seen`."""
    tool = call.get("tool")
    if tool == "search":
        query = str(call.get("query", ""))[:200]
        results = await web_search(query)
        seen["sources"].extend({"title": r["title"], "url": r["url"]} for r in results[:3])
        return f"Searching the web: {query}", as_text(results)

    name = str(call.get("place", ""))[:100]
    place = await geo.geocode(name) if name else None
    if not place:
        return f"Looking up {name or 'a place'}", f"No place called '{name}' was found in India."
    if tool == "weather":
        forecast = await weather.forecast(place["lat"], place["lon"])
        if not forecast:
            return f"Checking weather in {place['name']}", "Weather is unavailable right now."
        now_ = forecast["current"]
        return f"Checking live weather in {place['name']}", (
            f"Now in {place['label']}: {now_['temp']}°C, {now_['label']}, AQI {now_['aqi']}. "
            f"Next days: {weather_text(forecast, [d['date'] for d in forecast['daily']])}"
        )
    if tool == "places":
        guide = await destination_guide(place)
        seen["guides"][geo.slug(place["label"])] = guide
        return f"Reading what's trending in {place['name']}", guide_brief(guide, style)
    return "Thinking", f"Unknown tool '{tool}'. Answer now."


async def _agent_loop(system: str, messages: list[dict], style: str, seen: dict) -> AsyncIterator[dict]:
    """Let the model call tools until it answers; yields steps, then {"answer": ...}."""
    for calls in range(MAX_TOOL_CALLS + 1):
        answer = await ask_json(system, messages, tier="big", max_tokens=5000)
        if "tool" not in answer:
            break
        if calls == MAX_TOOL_CALLS:
            messages.append({"role": "user", "content": "No more tools. Give your final answer now."})
            continue
        label, result = await _run_tool(answer, style, seen)
        yield {"step": label}
        messages += [
            {"role": "assistant", "content": json.dumps(answer, ensure_ascii=False)},
            {"role": "user", "content": f"TOOL RESULT\n{result[:6000]}"},
        ]
    if "tool" in answer:
        raise AIUnavailable("I got stuck looking things up. Please ask again.")
    yield {"answer": answer}


async def _places_card(name: str, seen: dict) -> dict | None:
    """Top places for a destination, reusing a guide fetched during this turn when possible."""
    place = await geo.geocode(name)
    if not place:
        return None
    guide = seen["guides"].get(geo.slug(place["label"])) or await destination_guide(place)
    return {"place": place, "spots": [{k: t.get(k) for k in SPOT_FIELDS} for t in guide["trending"][:8]]}


async def converse(message: str, history: list[dict], user: dict | None, here: dict | None) -> AsyncIterator[dict]:
    """One turn of the planning chat."""
    today = date.today()
    context = (
        f"TODAY: {today:%A %Y-%m-%d}. PROFILE: {_profile(user)} "
        f"CURRENT LOCATION: {here['label'] if here else 'not shared'}."
    )
    messages = [
        {"role": "user", "content": context},
        {"role": "assistant", "content": '{"reply": "Noted. How can I help with your travels?", "questions": [], "brief": null, "suggestions": [], "show_places": null}'},
        *history,
        {"role": "user", "content": message},
    ]
    style = (user or {}).get("style", "comfort")
    seen: dict = {"sources": [], "guides": {}}
    try:
        async for event in _agent_loop(PLANNER_SYSTEM, messages, style, seen):
            if "step" in event:
                yield event
                continue
            raw = event["answer"]
            try:
                answer = AgentAnswer.model_validate(raw)
            except ValidationError:
                answer = AgentAnswer(reply=str(raw.get("reply") or "Sorry, could you say that another way?"))
            if answer.brief:
                answer.brief = _complete_brief(answer.brief, user, here, today)
            places = await _places_card(answer.show_places, seen) if answer.show_places else None
            reply = answer.model_dump(mode="json", exclude={"show_places"})
            yield {"message": {**reply, "places": places, "sources": seen["sources"][:4], "memory": json.dumps(raw, ensure_ascii=False)[:5000]}}
    except AIUnavailable as error:
        yield {"error": str(error)}


def _complete_brief(brief: Brief, user: dict | None, here: dict | None, today: date) -> Brief:
    """Fill gaps from the profile and keep dates in the future."""
    if not brief.start_date or brief.start_date < today:
        brief.start_date = next_saturday(today)
    if not brief.origin:
        brief.origin = (user or {}).get("home_city") or (here or {}).get("label")
    if brief.food_pref == "any" and user:
        brief.food_pref = user.get("food_pref", "any")
    if not brief.destination and here:
        brief.lat, brief.lon = here["lat"], here["lon"]
    return brief


ITEM_FIELDS = ("time", "name", "category", "description", "duration_min", "cost_inr", "tip")


async def assist_trip(trip: dict, message: str) -> AsyncIterator[dict]:
    """One turn of the in-trip assistant; the final event carries the updated trip."""
    place = trip["destination"]
    guide, forecast = await destination_guide(place), await weather.forecast(place["lat"], place["lon"])
    summary = {
        "destination": place["label"], "dates": f"{trip['start_date']} to {trip['end_date']}", "origin": trip.get("origin"),
        "travellers": trip["travellers"], "group": trip["group"], "style": trip["style"],
        "budget_limit": trip.get("budget_limit"), "budget": trip["budget"], "stay": trip.get("stay"),
        "days": [
            {"day": d["day"], "date": d["date"], "theme": d["theme"], "items": [{k: i.get(k) for k in ITEM_FIELDS} for i in d["items"]]}
            for d in trip["days"]
        ],
    }
    messages = [
        {
            "role": "user",
            "content": f"TODAY: {date.today():%Y-%m-%d}\nTRIP\n{json.dumps(summary, ensure_ascii=False)}\n\n"
            f"WEATHER\n{weather_text(forecast, [d['date'] for d in trip['days']])}\n\nDESTINATION GUIDE\n{guide_brief(guide, trip['style'])}",
        },
        {"role": "assistant", "content": '{"reply": "I have your trip. How can I help?", "days": [], "budget": null, "suggestions": []}'},
        *({"role": m["role"], "content": m["text"]} for m in trip.get("chat", [])[-6:]),
        {"role": "user", "content": message},
    ]
    seen: dict = {"sources": [], "guides": {geo.slug(place["label"]): guide}}
    try:
        async for event in _agent_loop(TRIP_SYSTEM, messages, trip["style"], seen):
            if "step" in event:
                yield event
                continue
            try:
                answer = TripAnswer.model_validate(event["answer"])
            except ValidationError:
                raise AIUnavailable("I couldn't apply that change. Please rephrase and try again.") from None

            changes: dict = {"updated_at": now()}
            if answer.days:
                # Existing stops keep their coordinates and photos; only new ones are looked up.
                existing = [item for day in trip["days"] for item in day["items"]]
                updated = {d.day: d for d in answer.days}
                merged = [updated[d["day"]].model_dump() if d["day"] in updated else d for d in trip["days"]]
                changes["days"] = await finish_days(merged, trip, known_places(existing, guide.get("trending", [])), reorder=False)
                for day in changes["days"]:
                    if day["day"] in updated:  # days the AI rewrote get realistic times; the others stay as they are
                        retime(day["items"])
            if answer.budget:
                changes["budget"] = answer.budget.with_total()
            reply = {"role": "assistant", "text": answer.reply or "Done — your plan is updated.", "sources": seen["sources"][:4], "suggestions": answer.suggestions}
            changes["chat"] = (trip.get("chat", []) + [{"role": "user", "text": message}, reply])[-TRIP_HISTORY_KEPT:]
            await trips.update_one({"_id": trip["_id"]}, {"$set": changes})
            yield {"trip": {**trip, **changes}, "changed": bool(answer.days or answer.budget)}
    except AIUnavailable as error:
        yield {"error": str(error)}

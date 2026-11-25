"""The "your trip starts tomorrow" email: subject, HTML (email-client safe: tables and inline styles) and plain text."""
from html import escape

from app.config import settings

INK, MUTED, LINE, PAPER, NIGHT, SAFFRON, TEAL = "#1F1B16", "#6B6257", "#EAE3D7", "#F4EFE6", "#0B1020", "#FF9F45", "#127A84"
SERIF = "Georgia,'Times New Roman',serif"
SANS = "-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"
CATEGORY = {"sight": "See", "food": "Eat", "shopping": "Shop", "activity": "Do", "travel": "Travel", "stay": "Stay"}


def clock12(hhmm: str) -> str:
    hours, minutes = (int(part) for part in hhmm.split(":"))
    return f"{hours % 12 or 12}:{minutes:02d} {'AM' if hours < 12 else 'PM'}"


def weather_line(day: dict | None) -> str | None:
    """One sentence about the first day's forecast, with what to pack for it."""
    if not day:
        return None
    advice = (
        "Carry an umbrella or a raincoat." if day["rain"] >= 60
        else "Carry water and sunscreen." if day["max"] >= 33
        else "Pack a warm layer for the evening." if day["min"] <= 12
        else "Looks like a lovely day to be out."
    )
    return f"{day['label']}, {round(day['min'])}–{round(day['max'])}°C, {day['rain']}% chance of rain. {advice}"


def _row(cells: str, padding: str = "0") -> str:
    return f'<tr><td style="padding:{padding};">{cells}</td></tr>'


def build(trip: dict, user: dict, when: str, forecast_day: dict | None) -> tuple[str, str, str]:
    """(subject, html, text) for one trip. `when` is "tomorrow" or "today"."""
    site = settings.site_url
    trip_url = f"{site}/trips/{trip['_id']}"
    profile_url = f"{site}/profile"
    place = trip["destination"]["name"]
    first_name = user["name"].split()[0]
    day = trip["days"][0]
    stops = day["items"][:7]
    weather = weather_line(forecast_day)
    packing = trip.get("packing", [])[:8]
    tips = trip.get("tips", [])[:2]
    cover = (trip.get("cover") or {}).get("url")
    e = escape

    subject = f"Your {place} trip starts {when} — here's your day 1"
    preheader = f"{trip['title']} · {len(stops)} stops planned for day 1" + (f" · {forecast_day['label']}" if forecast_day else "")

    logo = (
        f'<img src="{e(site)}/icon-192.png" width="34" height="34" alt="" style="vertical-align:middle;border-radius:9px;margin-right:10px;">'
        if site.startswith("https://") else ""
    )
    stop_rows = "".join(
        f'<tr><td style="padding:10px 0;border-top:1px solid {LINE};width:78px;vertical-align:top;font:600 13px {SANS};color:{MUTED};">{clock12(s["time"])}</td>'
        f'<td style="padding:10px 0;border-top:1px solid {LINE};vertical-align:top;">'
        f'<div style="font:700 15px {SANS};color:{INK};">{e(s["name"])}</div>'
        f'<div style="font:13px/1.5 {SANS};color:{MUTED};">{e(CATEGORY.get(s["category"], ""))}{" · " + e(s["description"]) if s.get("description") else ""}</div></td></tr>'
        for s in stops
    )
    packing_cells = "".join(
        f'<td style="width:50%;padding:4px 8px 4px 0;font:14px {SANS};color:{INK};vertical-align:top;">&#9744;&nbsp; {e(item)}</td>' + ("</tr><tr>" if i % 2 else "")
        for i, item in enumerate(packing)
    )
    tip_items = "".join(f'<li style="margin:0 0 6px;">{e(tip)}</li>' for tip in tips)

    html = f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light">
<title>{e(subject)}</title></head>
<body style="margin:0;padding:0;background:{PAPER};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">{e(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:{PAPER};"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:18px;overflow:hidden;">
  <tr><td style="background:{NIGHT};padding:18px 28px;">
    {logo}<span style="font:600 24px {SERIF};color:#F5F1E8;vertical-align:middle;">feel<i style="color:{SAFFRON};">&nbsp;it</i><span style="color:#22C3B5;">.</span></span>
  </td></tr>
  {f'<tr><td><img src="{e(cover)}" width="600" alt="{e(place)}" style="display:block;width:100%;max-width:600px;height:auto;"></td></tr>' if cover else ''}
  <tr><td style="padding:28px 28px 8px;">
    <div style="font:700 11px {SANS};letter-spacing:2px;text-transform:uppercase;color:{TEAL};">Your trip starts {e(when)}</div>
    <h1 style="margin:10px 0 6px;font:600 30px/1.15 {SERIF};color:{INK};">{e(trip['title'])}</h1>
    <p style="margin:0;font:15px/1.6 {SANS};color:{MUTED};">Hi {e(first_name)}, time to get ready! Here's everything for day 1 in {e(trip['destination']['label'])}.</p>
  </td></tr>
  {_row(f'<div style="background:#FFF6EA;border-left:4px solid {SAFFRON};border-radius:10px;padding:14px 16px;font:14px/1.5 {SANS};color:{INK};"><b>Weather {e(when)}:</b> {e(weather)}</div>', "16px 28px 0") if weather else ''}
  <tr><td style="padding:24px 28px 0;">
    <div style="font:600 20px {SERIF};color:{INK};">Day 1 · {e(day.get('theme') or 'Your first day')}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;">{stop_rows}</table>
  </td></tr>
  {_row(f'<div style="font:600 20px {SERIF};color:{INK};margin-bottom:8px;">Pack these</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>{packing_cells}</tr></table>', "22px 28px 0") if packing else ''}
  {_row(f'<div style="font:600 20px {SERIF};color:{INK};margin-bottom:8px;">Local tips</div><ul style="margin:0;padding-left:20px;font:14px/1.5 {SANS};color:{INK};">{tip_items}</ul>', "22px 28px 0") if tips else ''}
  <tr><td align="center" style="padding:28px;">
    <a href="{e(trip_url)}" style="display:inline-block;background:{SAFFRON};color:{NIGHT};font:700 15px {SANS};text-decoration:none;padding:14px 28px;border-radius:999px;">Open my full trip plan</a>
    <p style="margin:14px 0 0;font:13px {SANS};color:{MUTED};">Map, weather, budget and the AI assistant are all in your plan.</p>
  </td></tr>
  <tr><td style="background:{PAPER};padding:18px 28px;font:12px/1.6 {SANS};color:{MUTED};text-align:center;">
    Have a wonderful trip! — Feel It, your AI travel agent for India<br>
    You get one reminder before each trip you plan. <a href="{e(profile_url)}" style="color:{TEAL};">Turn off trip reminders</a>
  </td></tr>
</table></td></tr></table>
</body></html>"""

    text = "\n".join(
        [
            f"Hi {first_name},",
            "",
            f"Your trip \"{trip['title']}\" to {trip['destination']['label']} starts {when}.",
            *( [f"Weather {when}: {weather}", ""] if weather else [""] ),
            f"Day 1 · {day.get('theme') or 'Your first day'}",
            *(f"  {clock12(s['time'])}  {s['name']}" for s in stops),
            *( ["", "Pack these: " + ", ".join(packing)] if packing else [] ),
            "",
            f"Open your full trip plan: {trip_url}",
            "",
            "Have a wonderful trip! — Feel It",
            f"Turn off trip reminders: {profile_url}",
        ]
    )
    return subject, html, text

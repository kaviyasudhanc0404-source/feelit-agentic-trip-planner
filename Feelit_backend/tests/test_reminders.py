"""Trip reminder timing and email content (no network or database)."""
from datetime import date, datetime

from app.services import reminder_email
from app.services.reminders import IST, window

TRIP = {
    "_id": "t1",
    "title": "Misty <Kodai> Escape",
    "start_date": "2026-12-05",
    "destination": {"name": "Kodaikanal", "label": "Kodaikanal, Tamil Nadu", "lat": 10.2, "lon": 77.5},
    "cover": {"url": "https://images.example/kodai.jpg"},
    "days": [{"day": 1, "theme": "Lakes & views", "items": [
        {"time": "06:30", "name": "Bus from Chennai to Kodaikanal", "category": "travel", "description": "Overnight bus"},
        {"time": "13:15", "name": "Astoria", "category": "food", "description": "Lunch"},
    ]}],
    "packing": ["Rain jacket", "Warm sweater"],
    "tips": ["Carry cash for the market"],
}
USER = {"_id": "u1", "name": "Priya Sharma", "email": "priya@example.com"}


def test_the_reminder_window_is_the_evening_before_until_noon_on_day_one():
    opens, closes = window(date(2026, 12, 5))
    assert opens == datetime(2026, 12, 4, 20, 0, tzinfo=IST)
    assert closes == datetime(2026, 12, 5, 12, 0, tzinfo=IST)


def test_the_email_is_personal_escaped_and_uses_12_hour_times():
    subject, html, text = reminder_email.build(TRIP, USER, "tomorrow", {"label": "Light rain", "min": 12.4, "max": 17.8, "rain": 80})
    assert subject == "Your Kodaikanal trip starts tomorrow — here's your day 1"
    assert "Hi Priya" in html and "Misty &lt;Kodai&gt; Escape" in html and "<Kodai>" not in html
    assert "6:30 AM" in html and "1:15 PM" in html
    assert "Carry an umbrella" in html and "Rain jacket" in html
    assert "/trips/t1" in html and "/profile" in html
    assert "6:30 AM  Bus from Chennai to Kodaikanal" in text


def test_weather_advice_fits_the_forecast():
    assert reminder_email.weather_line(None) is None
    assert "sunscreen" in reminder_email.weather_line({"label": "Clear", "min": 26, "max": 35, "rain": 5})
    assert "warm layer" in reminder_email.weather_line({"label": "Clear", "min": 9, "max": 20, "rain": 5})

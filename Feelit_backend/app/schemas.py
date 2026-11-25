"""Request bodies and the shapes we accept back from the AI.

AI output is coerced leniently (prices as "150", unknown categories, blank dates), so a slightly
imperfect answer still becomes a valid trip instead of an error.
"""
import re
from datetime import date
from typing import Annotated, Literal

from pydantic import BaseModel, BeforeValidator, EmailStr, Field, field_validator

Style = Literal["budget", "comfort", "luxury"]
FoodPref = Literal["any", "veg", "nonveg", "vegan", "jain"]
CATEGORIES = {"sight", "food", "shopping", "activity", "travel", "stay"}
MAX_DAYS = 10


def _rupees(value) -> int:
    """AI output may give prices as 150, 150.0, "150" or null."""
    try:
        return max(0, round(float(str(value).replace(",", "").replace("₹", ""))))
    except (TypeError, ValueError):
        return 0


def _choice(allowed: tuple[str, ...], default: str):
    """Accept a value only if it is one of `allowed`, else fall back to `default`."""
    return BeforeValidator(lambda v: v if v in allowed else default)


Rupees = Annotated[int, BeforeValidator(_rupees)]
Text = Annotated[str, BeforeValidator(lambda v: "" if v is None else str(v))]
Short = Annotated[str, BeforeValidator(lambda v: str(v)[:300] if v is not None else "")]


# ---- auth & profile ----------------------------------------------------

def _fits_bcrypt(password: str) -> str:
    """bcrypt only reads 72 bytes; emoji or Indian scripts can pass a 72-character limit and still be longer."""
    if len(password.encode()) > 72:
        raise ValueError("Password is too long. Use at most 72 characters (fewer with emoji or non-English letters).")
    return password


def _new_password(password: str) -> str:
    if len(password) < 8 or not password.strip():
        raise ValueError("Use at least 8 characters for your password.")
    if not (re.search(r"[A-Za-z]", password) and re.search(r"\d", password)):
        raise ValueError("Use at least one letter and one number in your password.")
    return _fits_bcrypt(password)


def _indian_mobile(value) -> str:
    """Accept "98765 43210", "+91 98765-43210" or "09876543210"; store "+919876543210". Blank clears the number."""
    digits = re.sub(r"[\s\-().]", "", str(value or ""))
    if not digits:
        return ""
    match = re.fullmatch(r"(?:\+?91|0)?([6-9]\d{9})", digits)
    if not match:
        raise ValueError("Enter a valid 10-digit Indian mobile number.")
    return "+91" + match.group(1)


Password = Annotated[str, BeforeValidator(_fits_bcrypt), Field(min_length=1, max_length=200)]
Phone = Annotated[str, BeforeValidator(_indian_mobile), Field(max_length=13)]
NewPassword = Annotated[str, BeforeValidator(_new_password), Field(max_length=200)]
Name = Annotated[str, BeforeValidator(lambda v: " ".join(str(v).split())), Field(min_length=2, max_length=60)]


class RegisterIn(BaseModel):
    name: Name
    email: EmailStr
    password: NewPassword


class LoginIn(BaseModel):
    email: EmailStr
    password: Password


class PasswordCheckIn(BaseModel):
    password: Password


class PasswordIn(BaseModel):
    """Change a password (current one required), or set a first one on a Google-only account."""
    current_password: Password | None = None
    new_password: NewPassword


class GoogleIn(BaseModel):
    id_token: str = Field(min_length=20, max_length=4096)


class ProfileIn(BaseModel):
    name: Name | None = None
    trip_reminders: bool | None = None
    phone: Phone | None = None
    home_city: str | None = Field(None, max_length=80)
    style: Style | None = None
    food_pref: FoodPref | None = None


# ---- the trip brief: what the agent gathers and the planner builds from ----

class Brief(BaseModel):
    destination: str | None = Field(None, max_length=100)
    origin: str | None = Field(None, max_length=100)
    start_date: date | None = None
    days: int = 3
    travellers: int = 2
    group: Annotated[str, _choice(("solo", "couple", "family", "friends"), "couple")] = "couple"
    style: Annotated[str, _choice(("budget", "comfort", "luxury"), "comfort")] = "comfort"
    budget_inr: Rupees | None = None
    food_pref: Annotated[str, _choice(("any", "veg", "nonveg", "vegan", "jain"), "any")] = "any"
    pace: Annotated[str, _choice(("relaxed", "balanced", "packed"), "balanced")] = "balanced"
    interests: list[str] = Field(default_factory=list, max_length=10)
    notes: Short = ""
    lat: float | None = Field(None, ge=-90, le=90)
    lon: float | None = Field(None, ge=-180, le=180)

    @field_validator("days", "travellers", mode="before")
    @classmethod
    def _count(cls, value, info):
        limit = MAX_DAYS if info.field_name == "days" else 20
        return min(max(1, _rupees(value)), limit)

    @field_validator("start_date", mode="before")
    @classmethod
    def _date(cls, value):
        try:
            return date.fromisoformat(str(value)[:10]) if value else None
        except ValueError:
            return None

    @field_validator("destination", "origin", mode="before")
    @classmethod
    def _place(cls, value):
        text = str(value or "").strip()
        return text[:100] if text and text.lower() not in ("null", "none", "unknown") else None


# ---- trips -------------------------------------------------------------

class ShareIn(BaseModel):
    public: bool


class PlanItem(BaseModel):
    id: str | None = Field(None, max_length=20)
    time: Text = "09:00"
    name: str = Field(min_length=1, max_length=120)
    category: Text = "sight"
    description: Annotated[str, BeforeValidator(lambda v: str(v or "")[:400])] = ""
    duration_min: Rupees = 60
    cost_inr: Rupees = 0
    tip: str | None = Field(None, max_length=200)

    @field_validator("time")
    @classmethod
    def _clock(cls, value: str) -> str:
        match = re.match(r"^(\d{1,2}):(\d{2})\s*([ap]m)?", value.strip().lower())
        if not match:
            return "09:00"
        hour = int(match[1]) % 12 + (12 if match[3] == "pm" else 0) if match[3] else int(match[1]) % 24
        return f"{hour:02d}:{match[2]}"

    @field_validator("category")
    @classmethod
    def _category(cls, value: str) -> str:
        return value if value in CATEGORIES else "sight"


class PlanDay(BaseModel):
    day: int = 1
    theme: Annotated[str, BeforeValidator(lambda v: str(v or "")[:80])] = ""
    items: list[PlanItem] = Field(min_length=1, max_length=15)


class Budget(BaseModel):
    stay: Rupees = 0
    food: Rupees = 0
    transport: Rupees = 0
    activities: Rupees = 0
    misc: Rupees = 0

    def with_total(self) -> dict:
        parts = self.model_dump()
        return {**parts, "total": sum(parts.values())}


class TripUpdate(BaseModel):
    """A manual edit from the trip editor. Only the fields sent are changed."""
    title: str | None = Field(None, min_length=1, max_length=80)
    start_date: date | None = None
    travellers: int | None = Field(None, ge=1, le=20)
    style: Style | None = None
    budget_limit: int | None = Field(None, ge=0, le=10_000_000)
    budget: Budget | None = None
    days: list[PlanDay] | None = Field(None, min_length=1, max_length=MAX_DAYS)


# ---- the agent ---------------------------------------------------------

class Turn(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(max_length=6000)


class AgentIn(BaseModel):
    message: str = Field(min_length=1, max_length=1000)
    history: list[Turn] = Field(default_factory=list, max_length=16)
    lat: float | None = Field(None, ge=-90, le=90)
    lon: float | None = Field(None, ge=-180, le=180)


class ChatIn(BaseModel):
    message: str = Field(min_length=1, max_length=1000)


# ---- AI output ---------------------------------------------------------

class Stay(BaseModel):
    name: str
    area: Text = ""
    price_per_night_inr: Rupees | None = None
    why: Text = ""


class GettingThere(BaseModel):
    mode: Text = ""
    detail: Text = ""
    cost_inr: Rupees | None = None


class Event(BaseModel):
    name: str
    when: Text = ""
    detail: Text = ""


class Plan(BaseModel):
    title: str
    summary: Text = ""
    days: list[PlanDay] = Field(min_length=1)
    stay: Stay | None = None
    getting_there: GettingThere | None = None
    budget: Budget = Budget()
    packing: list[str] = []
    tips: list[str] = []
    events: list[Event] = []


class Question(BaseModel):
    id: Text = ""
    label: str
    options: list[str] = Field(default_factory=list, max_length=8)
    multi: bool = False


class AgentAnswer(BaseModel):
    """The agent's final answer in the planning chat."""
    reply: Text = ""
    questions: list[Question] = Field(default_factory=list, max_length=7)
    brief: Brief | None = None
    suggestions: list[str] = Field(default_factory=list, max_length=4)
    show_places: str | None = None


class TripAnswer(BaseModel):
    """The trip assistant's final answer: a reply plus any days or budget it changed."""
    reply: Text = ""
    days: list[PlanDay] = []
    budget: Budget | None = None
    suggestions: list[str] = Field(default_factory=list, max_length=4)

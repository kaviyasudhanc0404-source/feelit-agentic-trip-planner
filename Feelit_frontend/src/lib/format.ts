import {
  BedDouble, Camera, Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudRain, CloudSun, ShoppingBag, Snowflake,
  Sparkles, Sun, TrainFront, Utensils, type LucideIcon,
} from "lucide-react";
import type { Category, FoodPref, Group, Pace, Style } from "./types";

const rupees = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
export const inr = (amount: number) => rupees.format(amount);

/** Join class names, skipping falsy ones. */
export const cx = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(" ");

const asDate = (iso: string) => new Date(`${iso}T00:00:00`);
export const shortDate = (iso: string) => asDate(iso).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
export const todayIso = () => new Date().toLocaleDateString("en-CA");

export function dateRange(start: string, end: string) {
  const day = (iso: string) => asDate(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  return start === end ? shortDate(start) : `${day(start)} – ${day(end)} ${asDate(end).getFullYear()}`;
}

export const daysBetween = (from: string, to: string) => Math.round((asDate(to).getTime() - asDate(from).getTime()) / 86_400_000);

export const tripLength = (start: string, end: string) => {
  const days = daysBetween(start, end) + 1;
  return days === 1 ? "Day trip" : `${days} days`;
};

/** "In 5 days", "Tomorrow", "On now" or "Done", relative to today. */
export function countdown(start: string, end: string) {
  const today = todayIso();
  const until = daysBetween(today, start);
  if (until > 1) return `In ${until} days`;
  if (until === 1) return "Tomorrow";
  return daysBetween(today, end) >= 0 ? "Happening now" : "Completed";
}

/** "13:30" → { time: "1:30", period: "PM" } (12-hour clock). */
export function clock(time: string) {
  const [h, m = 0] = time.split(":").map(Number);
  if (Number.isNaN(h)) return { time, period: "" };
  return { time: `${h % 12 || 12}:${String(m).padStart(2, "0")}`, period: h < 12 ? "AM" : "PM" };
}
export const clockText = (time: string) => {
  const { time: t, period } = clock(time);
  return `${t} ${period}`.trim();
};

/**
 * An Indian mobile number as typed ("98765 43210", "+91 98765-43210", "09876543210") in the stored
 * form "+919876543210"; "" for a blank box; null when it isn't a valid number. The server checks it the same way.
 */
export function indianMobile(typed: string): string | null {
  const digits = typed.replace(/[\s\-().]/g, "");
  if (!digits) return "";
  const match = digits.match(/^(?:\+?91|0)?([6-9]\d{9})$/);
  return match ? `+91${match[1]}` : null;
}

/** "+919876543210" → "+91 98765 43210" */
export const showPhone = (phone: string) => phone.replace(/^\+91(\d{5})(\d{5})$/, "+91 $1 $2");

export function duration(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  return minutes % 60 ? `${Math.floor(minutes / 60)} h ${minutes % 60} min` : `${minutes / 60} h`;
}

type Option<T> = { value: T; label: string };
export const STYLES: Option<Style>[] = [
  { value: "budget", label: "Budget" },
  { value: "comfort", label: "Comfort" },
  { value: "luxury", label: "Luxury" },
];
export const GROUPS: Option<Group>[] = [
  { value: "solo", label: "Solo" },
  { value: "couple", label: "Couple" },
  { value: "family", label: "Family" },
  { value: "friends", label: "Friends" },
];
export const PACES: Option<Pace>[] = [
  { value: "relaxed", label: "Relaxed" },
  { value: "balanced", label: "Balanced" },
  { value: "packed", label: "Packed" },
];
export const FOODS: Option<FoodPref>[] = [
  { value: "any", label: "Anything" },
  { value: "veg", label: "Vegetarian" },
  { value: "nonveg", label: "Non-veg" },
  { value: "vegan", label: "Vegan" },
  { value: "jain", label: "Jain" },
];
export const INTERESTS = ["Nature", "Food", "Heritage", "Temples", "Adventure", "Beaches", "Shopping", "Nightlife", "Photography", "Wildlife"];
export const labelOf = <T,>(options: Option<T>[], value: T) => options.find((o) => o.value === value)?.label ?? String(value);

export const CATEGORY: Record<Category, { label: string; icon: LucideIcon; tint: string }> = {
  sight: { label: "See", icon: Camera, tint: "text-peacock bg-peacock/10" },
  activity: { label: "Do", icon: Sparkles, tint: "text-gold bg-gold/10" },
  food: { label: "Eat", icon: Utensils, tint: "text-coral bg-coral/10" },
  shopping: { label: "Shop", icon: ShoppingBag, tint: "text-rani bg-rani/10" },
  travel: { label: "Travel", icon: TrainFront, tint: "text-sky bg-sky/10" },
  stay: { label: "Stay", icon: BedDouble, tint: "text-saffron bg-saffron/10" },
};

/** Icon for a WMO weather code (as returned by Open-Meteo). */
export function weatherIcon(code: number): LucideIcon {
  if (code === 0) return Sun;
  if (code <= 2) return CloudSun;
  if (code === 3) return Cloud;
  if (code <= 48) return CloudFog;
  if (code <= 55) return CloudDrizzle;
  if (code <= 65 || (code >= 80 && code <= 82)) return CloudRain;
  if (code <= 86) return Snowflake;
  return CloudLightning;
}

export function aqiLabel(aqi: number) {
  if (aqi <= 50) return "Good air";
  if (aqi <= 100) return "Moderate air";
  if (aqi <= 150) return "Unhealthy for sensitive groups";
  return "Poor air";
}

const google = (path: string, q: string) => `https://www.google.com/${path}${encodeURIComponent(q)}`;
export const mapsLink = (name: string, near: string) => google("maps/search/?api=1&query=", `${name}, ${near}`);
export const hotelsLink = (name: string, near: string) => google("travel/search?q=", `${name} ${near}`);
export const whatsappLink = (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}`;

/** Where to actually book the journey: no free API gives live Indian fares, so we link out. */
export function bookingLink(mode: string, origin: string | null, destination: string, date: string) {
  const kind = mode.toLowerCase();
  if (kind.includes("train")) return { label: "Check trains on IRCTC", url: "https://www.irctc.co.in/nget/train-search" };
  if (kind.includes("flight")) return { label: "Check flights", url: google("travel/flights?q=", `Flights from ${origin ?? ""} to ${destination} on ${date}`) };
  if (kind.includes("bus")) return { label: "Check buses on redBus", url: "https://www.redbus.in/" };
  return { label: "Open route in Maps", url: google("maps/dir/?api=1&destination=", destination) + (origin ? `&origin=${encodeURIComponent(origin)}` : "") };
}

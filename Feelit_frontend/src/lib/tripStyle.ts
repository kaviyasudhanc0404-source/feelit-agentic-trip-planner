/**
 * How a trip is presented: which of the six layouts suits it, which colours suit the destination,
 * and the facts every layout shows (warnings, totals, travel time between stops).
 * Pure functions of the trip data, so the backend never needs to know about layouts.
 */
import { CalendarHeart, Compass, Gem, LayoutGrid, Map, Sparkles, type LucideIcon } from "lucide-react";
import { aqiLabel } from "./format";
import type { Stop, Trip, Weather } from "./types";

export type ViewId = "cinematic" | "bento" | "map" | "scrapbook" | "luxury" | "aurora";

export const VIEWS: { id: ViewId; label: string; hint: string; icon: LucideIcon; light?: boolean }[] = [
  { id: "cinematic", label: "Cinematic", hint: "Big photography, told day by day like a travel magazine", icon: Sparkles },
  { id: "map", label: "Map explorer", hint: "A large live map that follows you through each day", icon: Map },
  { id: "bento", label: "Bento board", hint: "Every number at a glance: budget, weather, route", icon: LayoutGrid },
  { id: "scrapbook", label: "Scrapbook", hint: "Polaroids, tickets and notes, made for group trips", icon: CalendarHeart, light: true },
  { id: "luxury", label: "Minimal luxury", hint: "Quiet, elegant and spacious, on warm ivory paper", icon: Gem, light: true },
  { id: "aurora", label: "Night timeline", hint: "The classic timeline with the map beside it", icon: Compass },
];

const has = (text: string, words: string[]) => words.some((word) => text.includes(word));

const NATURE = ["waterfall", "falls", "lake", "hill", "forest", "tea", "valley", "wildlife", "peak", "garden", "beach", "backwater", "national park", "dam", "viewpoint", "nature"];
const ADVENTURE = ["trek", "hike", "adventure", "rafting", "paragliding", "safari", "camping", "zipline", "scuba", "snorkel", "climb", "jeep"];
const CITY = ["museum", "fort", "palace", "heritage", "market", "street", "mall", "temple", "church", "mosque", "city", "bazaar"];

/** Every word the AI wrote about this trip, lower-cased, for the simple keyword checks below. */
function corpus(trip: Trip) {
  const stops = trip.days.flatMap((day) => [day.theme, ...day.items.map((s) => `${s.name} ${s.description}`)]);
  return [trip.title, trip.summary, trip.destination.label, trip.brief?.notes ?? "", ...(trip.brief?.interests ?? []), ...stops].join(" ").toLowerCase();
}

/** The layout that suits this trip best, with the reason shown to the traveller. */
export function pickView(trip: Trip): { id: ViewId; reason: string } {
  const text = corpus(trip);
  const km = totalKm(trip);
  if (trip.style === "luxury") return { id: "luxury", reason: "a luxury trip" };
  if (trip.group === "friends" || (trip.travellers >= 4 && trip.group !== "family")) return { id: "scrapbook", reason: "a trip with friends" };
  if (trip.style === "budget") return { id: "bento", reason: "a budget trip, so the numbers come first" };
  if (has(text, ADVENTURE) || km > 60) return { id: "map", reason: "an adventure with plenty of ground to cover" };
  if (has(text, NATURE)) return { id: "cinematic", reason: "a nature trip, best told in pictures" };
  if (has(text, CITY)) return { id: "map", reason: "a city to discover on the map" };
  return { id: "aurora", reason: "a classic day-by-day trip" };
}

/** Destination colours, as "r g b" triplets for CSS variables. `ink` is the readable version on light paper. */
const PALETTES = {
  coast: { tint: "79 209 197", tint2: "124 198 255", ink: "14 116 120" },
  hills: { tint: "123 211 137", tint2: "34 195 181", ink: "31 107 72" },
  desert: { tint: "242 166 90", tint2: "247 201 72", ink: "150 78 20" },
  snow: { tint: "154 208 245", tint2: "199 184 255", ink: "40 86 140" },
  heritage: { tint: "255 159 69", tint2: "232 55 142", ink: "168 64 20" },
};
export type Palette = (typeof PALETTES)[keyof typeof PALETTES];

export function paletteFor(trip: Trip): Palette {
  const text = corpus(trip);
  const state = trip.destination.state.toLowerCase();
  if (has(text, ["beach", "coast", "backwater", "island", "sea ", "bay"]) || ["goa", "andaman", "lakshadweep"].some((s) => state.includes(s))) return PALETTES.coast;
  if (has(text, ["snow", "glacier", "himalaya", "monastery"]) || ["ladakh", "himachal", "sikkim", "uttarakhand", "kashmir", "arunachal"].some((s) => state.includes(s))) return PALETTES.snow;
  if (has(text, ["desert", "dune", "camel"]) || state.includes("rajasthan")) return PALETTES.desert;
  if (has(text, ["hill", "tea", "forest", "waterfall", "falls", "valley", "coffee", "wildlife"])) return PALETTES.hills;
  return PALETTES.heritage;
}

/** CSS variables for a layout: destination colours, with the darker ink on light paper. */
export function paletteVars(palette: Palette, light: boolean) {
  return { "--tint": palette.tint, "--tint-2": palette.tint2, "--tint-ink": light ? palette.ink : palette.tint } as React.CSSProperties;
}

const MINUTES_PER_KM = 2; // same rule the planner uses: about 30 km/h on Indian roads

/** Rough travel time for a hop between two stops, in minutes. */
export const hopMinutes = (km: number) => Math.max(10, Math.ceil((km * MINUTES_PER_KM) / 5) * 5);

export const totalKm = (trip: Trip) => trip.days.reduce((sum, day) => sum + dayKm(day.items), 0);
export const dayKm = (stops: Stop[]) => Math.round(stops.reduce((sum, stop) => sum + (stop.km_from_prev ?? 0), 0));
export const dayCost = (stops: Stop[]) => stops.reduce((sum, stop) => sum + stop.cost_inr, 0);
export const places = (stops: Stop[]) => stops.filter((stop) => stop.category !== "travel");

/** Every stop with a photo, across the whole trip (for galleries and collages). */
export const photos = (trip: Trip) => trip.days.flatMap((day) => day.items.filter((stop) => stop.image).map((stop) => ({ ...stop, day: day.day })));

export const RAINY = 60;

export interface Warning {
  tone: "rain" | "air" | "money" | "road";
  text: string;
}

/** Things worth knowing before you go, worked out from the plan, the forecast and the budget. */
export function warningsFor(trip: Trip, weather?: Weather): Warning[] {
  const found: Warning[] = [];
  const dates = new Set(trip.days.map((day) => day.date));
  const wet = weather?.daily.filter((d) => dates.has(d.date) && d.rain >= RAINY) ?? [];
  if (wet.length) found.push({ tone: "rain", text: `Rain is likely on ${wet.length} of ${trip.days.length} day${trip.days.length > 1 ? "s" : ""}. Carry rain gear and keep the indoor backups ready.` });
  const aqi = weather?.current.aqi;
  if (aqi != null && aqi > 100) found.push({ tone: "air", text: `Air quality is ${aqiLabel(aqi).toLowerCase()} right now (AQI ${aqi}). A mask helps for children, elders and anyone with asthma.` });
  if (trip.budget_limit && trip.budget.total > trip.budget_limit) found.push({ tone: "money", text: `The estimate is above your budget. Ask Feel It to make the plan cheaper.` });
  const long = trip.days.flatMap((day) => day.items).find((stop) => stop.category === "travel" && stop.duration_min >= 360);
  if (long) found.push({ tone: "road", text: `${long.name} takes about ${Math.round(long.duration_min / 60)} hours. Book early and keep water and snacks handy.` });
  return found;
}

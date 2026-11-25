export type Style = "budget" | "comfort" | "luxury";
export type FoodPref = "any" | "veg" | "nonveg" | "vegan" | "jain";
export type Group = "solo" | "couple" | "family" | "friends";
export type Pace = "relaxed" | "balanced" | "packed";
export type Category = "sight" | "food" | "shopping" | "activity" | "travel" | "stay";

export interface User {
  id: string;
  name: string;
  email: string;
  home_city: string | null;
  /** Indian mobile number as "+91XXXXXXXXXX", or null. */
  phone: string | null;
  style: Style;
  food_pref: FoodPref;
  /** False for accounts created with Google that haven't set a password yet. */
  has_password: boolean;
  /** One email the evening before each trip. */
  trip_reminders: boolean;
}

export interface Place {
  name: string;
  state: string;
  label: string;
  lat: number;
  lon: number;
}

export interface Photo {
  url: string | null;
  credit?: string;
  link?: string;
}

/** What the agent gathers before building a trip; also the body of a build request. */
export interface Brief {
  destination: string | null;
  origin: string | null;
  start_date: string | null;
  days: number;
  travellers: number;
  group: Group;
  style: Style;
  budget_inr: number | null;
  food_pref: FoodPref;
  pace: Pace;
  interests: string[];
  notes: string;
  lat?: number | null;
  lon?: number | null;
}

export interface Stop {
  id: string;
  time: string;
  name: string;
  category: Category;
  description: string;
  duration_min: number;
  cost_inr: number;
  tip: string | null;
  lat?: number | null;
  lon?: number | null;
  image?: string | null;
  km_from_prev?: number | null;
}

export interface Day {
  day: number;
  date: string;
  theme: string;
  items: Stop[];
}

export interface Budget {
  stay: number;
  food: number;
  transport: number;
  activities: number;
  misc: number;
  total: number;
}

export interface TripCard {
  id: string;
  title: string;
  summary: string;
  destination: Place;
  start_date: string;
  end_date: string;
  travellers: number;
  style: Style;
  budget: Budget;
  cover: Photo | null;
  is_public: boolean;
}

interface Source {
  title: string;
  url: string;
}

export interface Question {
  id: string;
  label: string;
  options: string[];
  multi: boolean;
}

export interface GuideSpot {
  name: string;
  why: string;
  kind?: string;
  entry_fee_inr?: number | null;
  hours_needed?: number | null;
  lat?: number | null;
  lon?: number | null;
  image?: string | null;
  km?: number | null;
}

/** One message in a conversation with the agent (planning chat or trip assistant). */
export interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  steps?: string[];
  questions?: Question[];
  brief?: Brief | null;
  places?: { place: Place; spots: GuideSpot[] } | null;
  sources?: Source[];
  suggestions?: string[];
  /** The agent's raw answer, sent back as history so it remembers what it asked. */
  memory?: string;
}

export interface Trip extends TripCard {
  origin: string | null;
  group: string;
  budget_limit: number | null;
  days: Day[];
  stay: { name: string; area: string; price_per_night_inr: number | null; why: string } | null;
  getting_there: { mode: string; detail: string; cost_inr: number | null } | null;
  events?: { name: string; when: string; detail: string }[];
  packing: string[];
  tips: string[];
  chat?: ChatMessage[];
  share_id?: string;
  brief?: Brief;
}

export interface TripUpdate {
  title?: string;
  start_date?: string;
  travellers?: number;
  style?: Style;
  budget_limit?: number | null;
  budget?: Omit<Budget, "total">;
  days?: { theme: string; items: Omit<Stop, "lat" | "lon" | "image" | "km_from_prev">[] }[];
}

export interface Guide {
  place: Place;
  cover: Photo;
  tagline: string;
  about: string;
  best_time: string;
  ideal_days: number;
  trending: GuideSpot[];
  food: { name: string; known_for: string; area: string; cost_for_two_inr: number | null }[];
  shopping: { name: string; buy: string; area: string }[];
  stays: Partial<Record<Style, { name: string; area: string; price_per_night_inr: number | null }[]>>;
  getting_there: { mode: string; detail: string }[];
  tips: string[];
}

export interface TrendingPlace {
  name: string;
  state: string;
  why?: string;
  best_for?: string;
  ideal_days?: number;
  trips?: number;
  cover: Photo;
}

export interface Weather {
  current: { temp: number; code: number; label: string; aqi: number | null };
  daily: { date: string; code: number; label: string; max: number; min: number; rain: number }[];
}

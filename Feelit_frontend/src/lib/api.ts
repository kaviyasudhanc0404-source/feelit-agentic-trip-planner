import { readText, writeText } from "./storage";
import type { Brief, ChatMessage, Guide, GuideSpot, Place, TrendingPlace, Trip, TripCard, TripUpdate, User, Weather } from "./types";

const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000/api";
const TOKEN_KEY = "feelit_token";
export const SIGNED_OUT_EVENT = "feelit:signed-out";

export const token = {
  get: () => readText(TOKEN_KEY),
  set: (value: string) => writeText(TOKEN_KEY, value),
  clear: () => writeText(TOKEN_KEY, null),
};

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

async function send(path: string, method = "GET", body?: unknown): Promise<Response> {
  const saved = token.get();
  const call = () =>
    fetch(BASE + path, {
      method,
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(saved ? { Authorization: `Bearer ${saved}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  let response: Response;
  try {
    response = await call().catch(async (error) => {
      // Reads are safe to repeat: try once more in case the free server was asleep or the network blipped.
      if (method !== "GET") throw error;
      await new Promise((resolve) => setTimeout(resolve, 1500));
      return call();
    });
  } catch {
    throw new ApiError("Can't reach Feel It right now. Check your connection and try again.", 0);
  }
  if (response.ok) return response;

  if (response.status === 401 && saved) {
    token.clear();
    window.dispatchEvent(new Event(SIGNED_OUT_EVENT));
  }
  const detail = (await response.json().catch(() => null))?.detail;
  // Validation errors arrive as a list; show the first one without pydantic's "Value error, " prefix.
  const message = Array.isArray(detail) ? String(detail[0]?.msg ?? "").replace(/^Value error, /, "") : detail;
  throw new ApiError(message || "Something went wrong. Please try again.", response.status);
}

async function request<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const response = await send(path, method, body);
  return response.status === 204 ? (undefined as T) : response.json();
}

/* eslint-disable @typescript-eslint/no-explicit-any -- server-sent events are untyped JSON */
/**
 * POST and read a Server-Sent Events stream. Progress steps go to `onStep`;
 * the first event that `pick` recognises is the result. An error event throws.
 */
async function stream<T>(path: string, body: unknown, onStep: (step: string) => void, pick: (event: any) => T | undefined): Promise<T> {
  const reader = (await send(path, "POST", body)).body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop()!;
    for (const raw of events) {
      if (!raw.startsWith("data: ")) continue;
      const event = JSON.parse(raw.slice(6));
      if (event.step) onStep(event.step);
      if (event.error) throw new ApiError(event.error, 422);
      const result = pick(event);
      if (result !== undefined) return result;
    }
  }
  throw new ApiError("The connection closed before Feel It finished. Please try again.", 0);
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const query = (params: Record<string, string | number>) => new URLSearchParams(params as Record<string, string>).toString();

interface Session {
  token: string;
  user: User;
}

interface AgentRequest {
  message: string;
  history: { role: "user" | "assistant"; content: string }[];
  lat?: number;
  lon?: number;
}

export const api = {
  register: (name: string, email: string, password: string) => request<Session>("/auth/register", "POST", { name, email, password }),
  login: (email: string, password: string) => request<Session>("/auth/login", "POST", { email, password }),
  google: (idToken: string) => request<Session>("/auth/google", "POST", { id_token: idToken }),
  me: () => request<User>("/auth/me"),
  checkPassword: (password: string) => request<void>("/auth/password/check", "POST", { password }),
  setPassword: (current: string | null, next: string) => request<Session>("/auth/password", "POST", { current_password: current, new_password: next }),
  updateMe: (changes: Partial<Pick<User, "name" | "home_city" | "phone" | "style" | "food_pref" | "trip_reminders">>) => request<User>("/auth/me", "PATCH", changes),

  /** One turn with the planning agent. */
  agent: (body: AgentRequest, onStep: (step: string) => void) =>
    stream<ChatMessage>("/agent", body, onStep, (e) => (e.message ? { role: "assistant", text: e.message.reply, ...e.message } : undefined)),
  /** Builds a trip from a confirmed brief; resolves with the new trip's id. */
  plan: (brief: Brief, onStep: (step: string) => void) => stream<string>("/trips/plan", brief, onStep, (e) => e.trip_id),
  /** Asks the assistant inside a trip; resolves with the trip after any changes. */
  tripChat: (id: string, message: string, onStep: (step: string) => void) =>
    stream<{ trip: Trip; changed: boolean }>(`/trips/${id}/chat`, { message }, onStep, (e) => (e.trip ? e : undefined)),

  trips: () => request<TripCard[]>("/trips"),
  trip: (id: string) => request<Trip>(`/trips/${id}`),
  updateTrip: (id: string, changes: TripUpdate) => request<Trip>(`/trips/${id}`, "PATCH", changes),
  sharedTrip: (shareId: string) => request<Trip>(`/trips/shared/${shareId}`),
  deleteTrip: (id: string) => request<void>(`/trips/${id}`, "DELETE"),
  shareTrip: (id: string, isPublic: boolean) => request<{ is_public: boolean; share_id: string }>(`/trips/${id}/share`, "POST", { public: isPublic }),

  autocomplete: (text: string) => request<Place[]>(`/discover/autocomplete?${query({ q: text })}`),
  trending: () => request<{ web: TrendingPlace[]; travellers: TrendingPlace[] }>("/discover/trending"),
  nearby: (lat: number, lon: number) => request<{ here: Place; places: GuideSpot[] }>(`/discover/nearby?${query({ lat, lon })}`),
  guide: (place: string) => request<Guide>(`/discover/guide?${query({ place })}`),
  weather: (lat: number, lon: number) => request<Weather>(`/discover/weather?${query({ lat, lon })}`),
};

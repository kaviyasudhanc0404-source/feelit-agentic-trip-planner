/**
 * The building blocks every trip layout is made from. They read the trip from context and only use
 * the theme variables (ink, muted, line, panel, tint), so each one works on night and paper layouts.
 */
import { createContext, lazy, Suspense, useContext, useMemo, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle, BedDouble, CalendarDays, ChevronDown, Clock, CloudRain, ExternalLink, IndianRupee, Lightbulb, Luggage, MapPin, Navigation,
  PartyPopper, Route, TrainFront, Users, Utensils, Wallet, Wand2, Wind, type LucideIcon,
} from "lucide-react";
import { Picture } from "@/components/cards";
import { DayWeather } from "@/components/Weather";
import {
  aqiLabel, bookingLink, CATEGORY, clock, countdown, cx, dateRange, duration, hotelsLink, inr, mapsLink, shortDate, tripLength, weatherIcon,
} from "@/lib/format";
import { useStoredState } from "@/lib/storage";
import { dayCost, dayKm, hopMinutes, photos, places, RAINY, warningsFor, type Warning } from "@/lib/tripStyle";
import type { Budget, Category, Day, Stop, Trip, Weather } from "@/lib/types";

const TripMap = lazy(() => import("@/components/TripMap"));

/* ---------- context ---------- */

export interface TripCtx {
  trip: Trip;
  owner: boolean;
  weather?: Weather;
  /** The destination label, used to make Maps searches precise. */
  near: string;
  /** Send a request to the trip assistant (opens the drawer). */
  ask: (text: string) => void;
  dayIndex: number;
  setDayIndex: (index: number) => void;
  /** True for layouts on light paper. */
  light: boolean;
}

const Context = createContext<TripCtx | null>(null);
export const TripContext = Context.Provider;

export function useTrip() {
  const value = useContext(Context);
  if (!value) throw new Error("useTrip must be used inside a trip layout");
  return value;
}

/** The selected day and its stops that have a map position. */
export function useDay() {
  const { trip, dayIndex } = useTrip();
  const day = trip.days[dayIndex] ?? trip.days[0];
  const located = useMemo(() => day.items.filter((stop) => stop.lat != null), [day]);
  return { day, located };
}

/* ---------- trip header pieces ---------- */

/** When, who and what style: the facts every layout's header shows. */
export function useFacts() {
  const { trip } = useTrip();
  return [
    { icon: CalendarDays, label: "When", text: `${dateRange(trip.start_date, trip.end_date)} · ${tripLength(trip.start_date, trip.end_date)}` },
    { icon: Users, label: "Who", text: `${trip.travellers} ${trip.travellers === 1 ? "traveller" : "travellers"} · ${trip.group}` },
    { icon: Wallet, label: "Style", text: trip.style },
  ];
}

export function Countdown({ className }: { className?: string }) {
  const { trip } = useTrip();
  return <span className={cx("inline-block rounded-full bg-tint px-3 py-1 font-mono text-[11px] font-bold uppercase text-night", className)}>{countdown(trip.start_date, trip.end_date)}</span>;
}

/** The destination, linking to its live guide. */
export function DestinationLink({ className }: { className?: string }) {
  const { trip } = useTrip();
  return <Link to={`/explore/${encodeURIComponent(trip.destination.label)}`} className={cx("tap eyebrow hover:underline", className)}>{trip.destination.label}</Link>;
}

/* ---------- small pieces ---------- */

/** A titled block: the eyebrow heading most panels share. */
export function Panel({ title, icon: Icon, children, className, tone }: { title: string; icon?: LucideIcon; children: ReactNode; className?: string; tone?: string }) {
  return (
    <section className={cx("panel p-5", className)}>
      <p className={cx("eyebrow flex items-center gap-1.5", tone)}>{Icon && <Icon className="h-3.5 w-3.5" />}{title}</p>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function Clock12({ time, className }: { time: string; className?: string }) {
  const { time: t, period } = clock(time);
  return (
    <time dateTime={time} className={cx("font-mono leading-none", className)}>
      {t}<span className="ml-0.5 text-[0.6em] font-bold text-muted">{period}</span>
    </time>
  );
}

export function CategoryTag({ category, className }: { category: Category; className?: string }) {
  const { light } = useTrip();
  const { icon: Icon, label, tint } = CATEGORY[category];
  return (
    <span className={cx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold", light ? "bg-ink/5 text-ink/80" : tint, className)}>
      <Icon className="h-3 w-3" />{label}
    </span>
  );
}

/** Duration, cost and a Maps link for one stop. */
export function StopFacts({ stop, className }: { stop: Stop; className?: string }) {
  const { near } = useTrip();
  return (
    <div className={cx("flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted", className)}>
      {stop.duration_min > 0 && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{duration(stop.duration_min)}</span>}
      <span className="font-bold text-ink">{stop.cost_inr ? `~${inr(stop.cost_inr)}` : "Free"}</span>
      {stop.category !== "travel" && (
        <a href={mapsLink(stop.name, near)} target="_blank" rel="noreferrer" className="tap flex items-center gap-1 font-semibold text-tintink hover:underline">
          <MapPin className="h-3 w-3" />Open in Maps
        </a>
      )}
    </div>
  );
}

export function Tip({ text, className }: { text: string | null; className?: string }) {
  if (!text) return null;
  return <p className={cx("flex gap-1.5 text-xs font-medium text-tintink", className)}><Lightbulb className="mt-px h-3.5 w-3.5 shrink-0" />{text}</p>;
}

/** The road between two stops: "~15 min · 6 km". */
export function Hop({ stop, className }: { stop: Stop; className?: string }) {
  if (!stop.km_from_prev) return null;
  return (
    <p className={cx("flex items-center gap-1.5 font-mono text-[11px] text-muted", className)}>
      <Navigation className="h-3 w-3" />~{duration(hopMinutes(stop.km_from_prev))} · {stop.km_from_prev} km
    </p>
  );
}

/** Description and tip, folded away until asked for. */
export function Details({ stop, className }: { stop: Stop; className?: string }) {
  return (
    <details className={cx("group mt-2", className)}>
      <summary className="flex cursor-pointer list-none items-center gap-1 text-xs font-semibold text-muted hover:text-ink [&::-webkit-details-marker]:hidden">
        Details <ChevronDown className="h-3.5 w-3.5 transition group-open:rotate-180" />
      </summary>
      <div className="mt-2 space-y-2 animate-rise">
        <p className="text-sm text-muted">{stop.description}</p>
        <Tip text={stop.tip} />
        <StopFacts stop={stop} />
      </div>
    </details>
  );
}

/* ---------- days ---------- */

/** Switch between days. "pill" for night layouts, "line" for the quiet paper look. */
export function DayTabs({ variant = "pill", className }: { variant?: "pill" | "line"; className?: string }) {
  const { trip, dayIndex, setDayIndex, weather } = useTrip();
  if (trip.days.length < 2 && variant === "line") return null;
  return (
    <div className={cx("scroll-row", variant === "line" && "!gap-6 border-b border-line", className)} role="tablist">
      {trip.days.map((d, index) => {
        const on = index === dayIndex;
        return (
          <button
            key={d.day}
            role="tab"
            aria-selected={on}
            onClick={() => setDayIndex(index)}
            className={cx(
              "shrink-0 snap-start text-left transition",
              variant === "pill"
                ? cx("rounded-2xl border px-4 py-2.5", on ? "border-tint/60 bg-tint/15" : "border-line hover:bg-ink/5")
                : cx("-mb-px border-b-2 pb-3", on ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink"),
            )}
          >
            <span className="block text-sm font-bold">Day {d.day} · {shortDate(d.date)}</span>
            <DayWeather weather={weather} date={d.date} />
          </button>
        );
      })}
    </div>
  );
}

/** Rain warning for a day plus the owner's quick AI actions for it. */
export function DayTools({ day, className }: { day: Day; className?: string }) {
  const { owner, ask, weather } = useTrip();
  const rain = weather?.daily.find((row) => row.date === day.date)?.rain ?? 0;
  if (!owner && rain < RAINY) return null;
  return (
    <div className={cx("no-print flex flex-wrap items-center gap-2", className)}>
      {rain >= RAINY && (
        <span className="inline-flex items-center gap-2 rounded-full border border-line bg-sky/10 px-3 py-1.5 text-xs font-semibold">
          <CloudRain className="h-3.5 w-3.5 text-sky" />Rain likely ({rain}%)
          {owner && <button className="tap font-bold text-tintink underline" onClick={() => ask(`Rain is likely on day ${day.day}. Swap outdoor stops for good indoor or covered ones.`)}>Make it rain-proof</button>}
        </span>
      )}
      {owner && (
        <button className="btn btn-ghost !px-3 !py-1.5 text-xs" onClick={() => ask(`Re-plan day ${day.day} with fresh ideas, keeping the same pace and budget.`)}>
          <Wand2 className="h-3.5 w-3.5" />Re-plan day {day.day}
        </button>
      )}
    </div>
  );
}

/** Stops, kilometres and spend for a day. */
export function DayStats({ day, className }: { day: Day; className?: string }) {
  const cost = dayCost(day.items);
  const km = dayKm(day.items);
  const rows = [
    ["Places", String(places(day.items).length)],
    ["On the road", km ? `~${km} km` : "—"],
    ["Day's spend", cost ? `~${inr(cost)}` : "Free"],
  ];
  return (
    <div className={cx("grid grid-cols-3 divide-x divide-[color:var(--line)] text-center", className)}>
      {rows.map(([label, value]) => (
        <div key={label} className="px-2 py-3">
          <p className="font-display text-lg sm:text-xl">{value}</p>
          <p className="font-mono text-[10px] uppercase tracking-wider text-muted">{label}</p>
        </div>
      ))}
    </div>
  );
}

/* ---------- map ---------- */

export function RouteMap({ stops, className, active, onPick }: { stops: Stop[]; className?: string; active?: string | null; onPick?: (id: string) => void }) {
  const { trip, light } = useTrip();
  return (
    <Suspense fallback={<div className={cx("skeleton !rounded-none", className ?? "h-72")} />}>
      <TripMap stops={stops} centre={trip.destination} tone={light ? "paper" : "night"} active={active} onPick={onPick} className={className} />
    </Suspense>
  );
}

/* ---------- money ---------- */

export const BUDGET_ROWS: { key: Exclude<keyof Budget, "total">; label: string; color: string }[] = [
  { key: "stay", label: "Stay", color: "#FF9F45" },
  { key: "food", label: "Food", color: "#FF5D73" },
  { key: "transport", label: "Transport", color: "#7CC6FF" },
  { key: "activities", label: "Tickets & activities", color: "#22C3B5" },
  { key: "misc", label: "Shopping & extras", color: "#E8378E" },
];

/** "₹3,560 under your ₹22,500 budget", or over it. */
export function LimitNote({ className }: { className?: string }) {
  const { trip } = useTrip();
  if (!trip.budget_limit) return null;
  const over = trip.budget.total - trip.budget_limit;
  return (
    <p className={cx("rounded-xl px-3 py-2 text-xs font-bold", over > 0 ? "bg-coral/15 text-coral" : "bg-peacock/15 text-tintink", className)}>
      {over > 0 ? `${inr(over)} over your ${inr(trip.budget_limit)} budget` : `${inr(-over)} under your ${inr(trip.budget_limit)} budget`}
    </p>
  );
}

/** Budget breakdown as stacked bars, or as a ring for dashboard tiles. */
export function BudgetPanel({ variant = "bars", className }: { variant?: "bars" | "ring"; className?: string }) {
  const { trip } = useTrip();
  const { budget, travellers } = trip;
  const total = budget.total || 1;
  const rows = BUDGET_ROWS.filter(({ key }) => budget[key] > 0);
  let angle = 0;
  const ring = rows.map(({ key, color }) => {
    const from = angle;
    angle += (budget[key] / total) * 360;
    return `${color} ${from}deg ${angle}deg`;
  });

  const legend = (
    <ul className="space-y-1.5 text-sm">
      {rows.map(({ key, label, color }) => (
        <li key={key} className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-muted"><span className="h-2 w-2 rounded-full" style={{ background: color }} />{label}</span>
          <span className="font-semibold">{inr(budget[key])}</span>
        </li>
      ))}
    </ul>
  );

  return (
    <Panel title="Estimated budget" icon={Wallet} className={className}>
      <div className={cx(variant === "ring" && "flex flex-wrap items-center gap-5")}>
        {variant === "ring" && (
          <div className="relative h-28 w-28 shrink-0 rounded-full" style={{ background: `conic-gradient(${ring.join(",")})` }}>
            <div className="absolute inset-3 flex flex-col items-center justify-center rounded-full bg-[color:var(--panel-solid)] text-center">
              <IndianRupee className="h-4 w-4 text-muted" />
              <span className="font-mono text-[10px] text-muted">{travellers > 1 ? "per person" : "total"}</span>
              <span className="font-display text-sm">{inr(Math.round(budget.total / travellers))}</span>
            </div>
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="font-display text-4xl">{inr(budget.total)}</p>
          <p className="font-mono text-[11px] text-muted">{travellers > 1 && `${inr(Math.round(budget.total / travellers))} per person · `}AI estimate from live prices</p>
        </div>
      </div>
      <LimitNote className="mt-3" />
      {variant === "bars" && (
        <div className="mt-4 flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-ink/5">
          {rows.map(({ key, color }) => <span key={key} style={{ width: `${(budget[key] / total) * 100}%`, background: color }} />)}
        </div>
      )}
      <div className="mt-3">{legend}</div>
    </Panel>
  );
}

/* ---------- weather ---------- */

export function WeatherPanel({ className }: { className?: string }) {
  const { trip, weather } = useTrip();
  if (!weather) return <div className={cx("skeleton h-40", className)} />;
  const days = weather.daily.filter((d) => trip.days.some((t) => t.date === d.date));
  const rainy = days.filter((d) => d.rain >= RAINY).length;
  const { temp, code, label, aqi } = weather.current;
  const Now = weatherIcon(code);
  return (
    <Panel title="Weather" className={className}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <span className="inline-flex items-center gap-1.5 font-semibold"><Now className="h-5 w-5 text-gold" />{temp}°C · {label} now</span>
        {aqi != null && <span className="inline-flex items-center gap-1 text-muted"><Wind className="h-4 w-4" />AQI {aqi} · {aqiLabel(aqi)}</span>}
      </div>
      {days.length ? (
        <>
          <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-5">
            {days.map((d) => {
              const Icon = weatherIcon(d.code);
              return (
                <div key={d.date} className={cx("rounded-2xl border p-2 text-center", d.rain >= RAINY ? "border-sky/40 bg-sky/10" : "border-line")}>
                  <p className="font-mono text-[10px] text-muted">{shortDate(d.date)}</p>
                  <Icon className="mx-auto my-1 h-5 w-5" />
                  <p className="text-xs font-semibold">{d.max}° <span className="text-muted">{d.min}°</span></p>
                  <p className="font-mono text-[10px] text-sky">{d.rain}% rain</p>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-muted">{rainy ? `Rain is likely on ${rainy} of ${days.length} days.` : "Looks dry for your dates. Great for outdoor plans."}</p>
        </>
      ) : (
        <p className="mt-3 text-xs text-muted">Day-by-day forecasts open 16 days before you travel. Feel It planned for the usual season until then.</p>
      )}
    </Panel>
  );
}

/* ---------- logistics ---------- */

/** How to get there and back: the AI's advice, every journey in the plan, and where to book. */
export function JourneyPanel({ className }: { className?: string }) {
  const { trip } = useTrip();
  const journeys = trip.days.flatMap((day) => day.items.filter((stop) => stop.category === "travel").map((stop) => ({ stop, day })));
  const way = trip.getting_there;
  if (!way && !journeys.length) return null;
  const booking = bookingLink(way?.mode ?? journeys[0]?.stop.name ?? "", trip.origin, trip.destination.name, trip.start_date);
  return (
    <Panel title={`Getting there${trip.origin ? ` from ${trip.origin.split(",")[0]}` : ""}`} icon={TrainFront} className={className}>
      {way && <p className="text-sm">{way.detail}</p>}
      {journeys.length > 0 && (
        <ol className="mt-3 space-y-2">
          {journeys.map(({ stop, day }) => (
            <li key={stop.id} className="flex items-start gap-3 text-sm">
              <Route className="mt-0.5 h-4 w-4 shrink-0 text-tintink" />
              <span className="min-w-0 flex-1">
                <b>{stop.name}</b>
                <span className="block font-mono text-[11px] text-muted">Day {day.day} · <Clock12 time={stop.time} /> · {duration(stop.duration_min)}{stop.cost_inr ? ` · ~${inr(stop.cost_inr)}` : ""}</span>
              </span>
            </li>
          ))}
        </ol>
      )}
      <div className="mt-3 flex items-center justify-between gap-3">
        {way?.cost_inr ? <span className="font-display text-xl">~{inr(way.cost_inr)}</span> : <span />}
        <a href={booking.url} target="_blank" rel="noreferrer" className="tap inline-flex items-center gap-1 text-sm font-bold text-tintink">{booking.label} <ExternalLink className="h-3.5 w-3.5" /></a>
      </div>
    </Panel>
  );
}

export function StayPanel({ className }: { className?: string }) {
  const { trip, near } = useTrip();
  if (!trip.stay) return null;
  const { stay } = trip;
  return (
    <Panel title="Where you'll stay" icon={BedDouble} className={className}>
      <h3 className="font-sans text-lg font-bold">{stay.name}</h3>
      <p className="text-sm text-muted">{[stay.area, stay.why].filter(Boolean).join(" · ")}</p>
      <div className="mt-3 flex items-center justify-between">
        {stay.price_per_night_inr ? <span className="font-display text-xl">~{inr(stay.price_per_night_inr)}<span className="text-xs text-muted"> / night</span></span> : <span />}
        <a href={hotelsLink(stay.name, near)} target="_blank" rel="noreferrer" className="tap inline-flex items-center gap-1 text-sm font-bold text-tintink">Live prices <ExternalLink className="h-3.5 w-3.5" /></a>
      </div>
    </Panel>
  );
}

/** Every meal stop in the plan, as a food list. */
export function FoodPanel({ className }: { className?: string }) {
  const { trip, near } = useTrip();
  const meals = trip.days.flatMap((day) => day.items.filter((stop) => stop.category === "food").map((stop) => ({ stop, day: day.day })));
  if (!meals.length) return null;
  return (
    <Panel title="Where you'll eat" icon={Utensils} className={className}>
      <ul className="divide-y divide-[color:var(--line)]">
        {meals.map(({ stop, day }) => (
          <li key={stop.id} className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
            <span className="min-w-0">
              <a href={mapsLink(stop.name, near)} target="_blank" rel="noreferrer" className="tap font-semibold hover:text-tintink">{stop.name}</a>
              <span className="block text-xs text-muted">{stop.description}</span>
            </span>
            <span className="shrink-0 text-right font-mono text-[11px] text-muted">Day {day}<br /><Clock12 time={stop.time} /></span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

export function EventsPanel({ className }: { className?: string }) {
  const { trip } = useTrip();
  if (!trip.events?.length) return null;
  return (
    <Panel title="Happening around your trip" icon={PartyPopper} className={className}>
      <ul className="space-y-3">
        {trip.events.map((event, i) => <li key={i} className="text-sm"><b>{event.name}</b> <span className="font-mono text-[11px] text-muted">{event.when}</span><p className="text-muted">{event.detail}</p></li>)}
      </ul>
    </Panel>
  );
}

export function TipsPanel({ className }: { className?: string }) {
  const { trip } = useTrip();
  if (!trip.tips.length) return null;
  return (
    <Panel title="Local tips" icon={Lightbulb} className={className}>
      <ul className="space-y-2 text-sm">{trip.tips.map((tip, i) => <li key={i} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-tint" />{tip}</li>)}</ul>
    </Panel>
  );
}

const WARNING_ICON: Record<Warning["tone"], LucideIcon> = { rain: CloudRain, air: Wind, money: Wallet, road: Route };

/** Things to know before going, worked out from the forecast, the budget and the journeys. */
export function WarningsPanel({ className }: { className?: string }) {
  const { trip, weather } = useTrip();
  const warnings = warningsFor(trip, weather);
  if (!warnings.length) return null;
  return (
    <Panel title="Good to know" icon={AlertTriangle} className={cx("border-coral/30", className)} tone="!text-coral">
      <ul className="space-y-2.5 text-sm">
        {warnings.map(({ tone, text }) => {
          const Icon = WARNING_ICON[tone];
          return <li key={tone} className="flex gap-2.5"><Icon className="mt-0.5 h-4 w-4 shrink-0 text-coral" />{text}</li>;
        })}
      </ul>
    </Panel>
  );
}

/** Packing ticks for this trip, remembered on this device. */
export function usePacking() {
  const { trip } = useTrip();
  const [packed, setPacked] = useStoredState<string[]>(`feelit_packed_${trip.id}`, []);
  const toggle = (item: string) => setPacked(packed.includes(item) ? packed.filter((p) => p !== item) : [...packed, item]);
  return { items: trip.packing, packed, toggle, done: packed.filter((p) => trip.packing.includes(p)).length };
}

export function PackingPanel({ className }: { className?: string }) {
  const { items, packed, toggle, done } = usePacking();
  if (!items.length) return null;
  return (
    <Panel title={`Pack for this trip · ${done}/${items.length}`} icon={Luggage} className={className}>
      <ul className="grid gap-2">
        {items.map((item, i) => (
          <li key={i}>
            <label className="flex cursor-pointer items-center gap-2.5 text-sm">
              <input type="checkbox" checked={packed.includes(item)} onChange={() => toggle(item)} className="h-4 w-4 accent-[rgb(var(--tint-ink))]" />
              <span className={cx(packed.includes(item) && "text-muted line-through")}>{item}</span>
            </label>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/** The supporting panels, laid out as a masonry of columns. */
export function Extras({ className, columns = "md:columns-2 xl:columns-3", skip = [] }: { className?: string; columns?: string; skip?: ("budget" | "weather" | "journey" | "food")[] }) {
  return (
    <div className={cx("columns-1 gap-5 [&>*]:mb-5 [&>*]:break-inside-avoid", columns, className)}>
      <WarningsPanel />
      {!skip.includes("budget") && <BudgetPanel />}
      {!skip.includes("weather") && <WeatherPanel />}
      {!skip.includes("journey") && <JourneyPanel />}
      <StayPanel />
      {!skip.includes("food") && <FoodPanel />}
      <EventsPanel />
      <PackingPanel />
      <TipsPanel />
    </div>
  );
}

/* ---------- photos ---------- */

export function CoverPhoto({ className, imgClassName }: { className?: string; imgClassName?: string }) {
  const { trip } = useTrip();
  return (
    <div className={cx("relative overflow-hidden", className)}>
      <Picture src={trip.cover?.url} alt={trip.destination.name} className={cx("h-full w-full", imgClassName)} />
      {trip.cover?.credit && (
        <a href={trip.cover.link} target="_blank" rel="noreferrer" className="tap absolute bottom-2 right-3 font-mono text-[10px] text-white/70 hover:text-white">Photo: {trip.cover.credit}</a>
      )}
    </div>
  );
}

/** A horizontal strip of every photographed stop in the trip. */
export function Gallery({ className, onOpenDay }: { className?: string; onOpenDay?: (day: number) => void }) {
  const { trip } = useTrip();
  const shots = photos(trip);
  if (shots.length < 2) return null;
  return (
    <div className={cx("scroll-row", className)}>
      {shots.map((stop, i) => (
        <button
          key={stop.id}
          onClick={() => onOpenDay?.(stop.day)}
          className={cx("group relative shrink-0 snap-start overflow-hidden text-left [border-radius:var(--radius)]", i % 3 === 0 ? "h-72 w-60" : "h-72 w-44 sm:w-52")}
        >
          <Picture src={stop.image} alt={stop.name} className="h-full w-full transition duration-700 group-hover:scale-110" />
          <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3 pt-10 text-white">
            <span className="font-mono text-[10px] uppercase tracking-widest text-white/70">Day {stop.day}</span>
            <span className="block text-sm font-bold leading-snug">{stop.name}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

/* ---------- floating widgets ---------- */

/** Weather and budget that stay in view while the itinerary scrolls (large screens). */
export function FloatingWidgets() {
  const { trip, weather } = useTrip();
  const { day } = useDay();
  const forecast = weather?.daily.find((row) => row.date === day.date);
  const Icon = weatherIcon(forecast?.code ?? weather?.current.code ?? 0);
  return (
    <div className="no-print pointer-events-none fixed bottom-8 left-8 z-30 hidden xl:block">
      <div className="pointer-events-auto flex items-center gap-4 rounded-full border border-line bg-[color:var(--panel-solid)] px-5 py-2.5 shadow-lift backdrop-blur-xl animate-float">
        {weather && (
          <span className="flex items-center gap-1.5 text-sm font-semibold">
            <Icon className="h-4 w-4 text-gold" />
            {forecast ? `${forecast.max}° · ${forecast.rain}% rain` : `${weather.current.temp}°C now`}
          </span>
        )}
        <span className="h-4 w-px bg-ink/20" />
        <span className="flex items-center gap-1.5 text-sm font-semibold"><Wallet className="h-4 w-4 text-tintink" />{inr(trip.budget.total)}</span>
      </div>
    </div>
  );
}

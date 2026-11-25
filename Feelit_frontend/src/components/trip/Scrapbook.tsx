import type { ReactNode } from "react";
import { ArrowRight, Plane } from "lucide-react";
import { Picture } from "@/components/cards";
import { DayWeather } from "@/components/Weather";
import { cx, dateRange, duration, inr, mapsLink, shortDate } from "@/lib/format";
import { hopMinutes, photos } from "@/lib/tripStyle";
import type { Day, Stop } from "@/lib/types";
import {
  BUDGET_ROWS, CategoryTag, Clock12, Countdown, DayTabs, DayTools, DestinationLink, EventsPanel, FoodPanel, JourneyPanel, LimitNote,
  RouteMap, StayPanel, useDay, usePacking, useTrip, WarningsPanel, WeatherPanel,
} from "./kit";

const TILT = ["-rotate-2", "rotate-1", "-rotate-1", "rotate-2", "rotate-0"];

/** A travel scrapbook on kraft paper: polaroids, ticket stubs and handwritten notes. Made for group trips. */
export default function Scrapbook({ actions }: { actions: ReactNode }) {
  const { trip } = useTrip();
  const shots = photos(trip).slice(0, 2);

  return (
    <div className="page">
      <section className="grid items-center gap-12 pt-4 lg:grid-cols-[1.05fr_1fr]">
        <div className="relative mx-auto h-[20rem] w-[92%] max-w-xl sm:h-[30rem] sm:w-full">
          <Polaroid src={trip.cover?.url} caption={trip.destination.name} className="absolute left-0 top-6 w-[64%] -rotate-[5deg]" />
          {shots[0] && <Polaroid src={shots[0].image} caption={shots[0].name} className="absolute right-3 top-0 w-[42%] rotate-[6deg] sm:right-0 sm:w-[44%]" />}
          {shots[1] && <Polaroid src={shots[1].image} caption={shots[1].name} className="absolute bottom-0 right-6 w-[46%] -rotate-[2deg]" />}
        </div>
        <div>
          <p className="font-hand text-3xl text-tintink">{trip.travellers > 1 ? `${trip.travellers} of us, one ${trip.group} trip!` : "Just me and the road!"}</p>
          <h1 className="mt-2 text-5xl leading-[0.95] sm:text-6xl">{trip.title}</h1>
          <p className="mt-4 max-w-xl text-muted">{trip.summary}</p>
          <BoardingPass />
        </div>
      </section>

      {actions}

      {trip.days.map((day) => <Page key={day.day} day={day} />)}

      <MapPage />

      <section className="mt-20 grid items-start gap-8 md:grid-cols-2 lg:grid-cols-3">
        <Receipt />
        <div className="space-y-8"><Packing /><WarningsPanel /></div>
        <div className="space-y-8">
          <Notes />
          <JourneyPanel />
          <StayPanel />
        </div>
      </section>
      <section className="mt-8 grid items-start gap-8 md:grid-cols-2">
        <FoodPanel />
        <div className="space-y-8"><WeatherPanel /><EventsPanel /></div>
      </section>
    </div>
  );
}

function Polaroid({ src, caption, className }: { src?: string | null; caption: string; className?: string }) {
  return (
    <figure className={cx("polaroid", className)}>
      <span className="tape -top-3 left-1/2 -translate-x-1/2 rotate-[-4deg]" />
      <Picture src={src} alt={caption} className="aspect-square w-full" />
      <figcaption className="absolute inset-x-3 bottom-2 truncate text-center font-hand text-xl text-ink/80">{caption}</figcaption>
    </figure>
  );
}

/** Origin → destination, dates and travellers, as a torn-off ticket. */
function BoardingPass() {
  const { trip } = useTrip();
  const from = trip.origin?.split(",")[0] ?? "Home";
  return (
    <div className="ticket relative mt-8 grid max-w-lg grid-cols-[1fr_auto] text-ink">
      <div className="p-5 pr-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted">Feel It · boarding pass</p>
        <div className="mt-3 flex items-center gap-3 font-display text-2xl">
          <span className="truncate">{from}</span><Plane className="h-5 w-5 shrink-0 text-tintink" /><span className="truncate">{trip.destination.name}</span>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3 font-mono text-[11px] uppercase">
          <span><span className="block text-muted">When</span>{dateRange(trip.start_date, trip.end_date)}</span>
          <span><span className="block text-muted">Crew</span>{trip.travellers} · {trip.group}</span>
          <span><span className="block text-muted">Class</span>{trip.style}</span>
        </div>
      </div>
      <div className="flex flex-col items-center justify-center gap-2 border-l-2 border-dashed border-line px-5">
        <Countdown className="!rotate-[-8deg]" />
        <DestinationLink className="max-w-[7rem] text-center !text-[9px]" />
      </div>
    </div>
  );
}

function Page({ day }: { day: Day }) {
  const { weather } = useTrip();
  return (
    <section className="mt-20">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="relative">
          <span className="tape -left-3 top-3 !h-9 !w-40 -rotate-2" />
          <h2 className="relative font-hand text-5xl font-bold">Day {day.day}</h2>
          <p className="relative mt-1 font-display text-2xl italic">{day.theme}</p>
        </div>
        <div className="flex items-center gap-4">
          <DayTools day={day} />
          <div className="flex h-24 w-24 -rotate-12 flex-col items-center justify-center rounded-full border-2 border-dashed border-tintink/60 text-center text-tintink">
            <span className="font-mono text-[10px] font-bold uppercase leading-tight">{shortDate(day.date)}</span>
            <DayWeather weather={weather} date={day.date} />
          </div>
        </div>
      </div>
      <ol className="mt-10 grid items-start gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
        {day.items.map((stop, index) => (
          <li key={stop.id} className={cx("relative transition", TILT[index % TILT.length])}>
            {stop.km_from_prev ? <p className="mb-2 flex items-center gap-1 font-hand text-lg text-muted"><ArrowRight className="h-4 w-4" />{duration(hopMinutes(stop.km_from_prev))} · {stop.km_from_prev} km</p> : null}
            <Keepsake stop={stop} />
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Each stop as the keepsake it would be: a ticket, a photo, a menu note or a sticky note. */
function Keepsake({ stop }: { stop: Stop }) {
  const { near } = useTrip();
  const facts = (
    <p className="mt-2 flex flex-wrap items-center gap-x-3 font-mono text-[11px] text-muted">
      <Clock12 time={stop.time} className="font-bold text-ink" />
      {stop.duration_min > 0 && <span>{duration(stop.duration_min)}</span>}
      <span className="font-bold text-ink">{stop.cost_inr ? `~${inr(stop.cost_inr)}` : "Free"}</span>
      {stop.category !== "travel" && <a href={mapsLink(stop.name, near)} target="_blank" rel="noreferrer" className="tap font-sans font-bold text-tintink hover:underline">Map</a>}
    </p>
  );
  const tip = stop.tip && <p className="mt-2 font-hand text-lg leading-tight text-tintink">“{stop.tip}”</p>;

  if (stop.category === "travel") {
    return (
      <div className="ticket p-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted">Admit all · journey</p>
        <p className="mt-2 font-display text-xl leading-snug">{stop.name}</p>
        <p className="mt-1 text-sm text-muted">{stop.description}</p>
        {facts}
      </div>
    );
  }
  if (stop.image) {
    return (
      <figure className="polaroid relative !pb-4">
        <span className="tape -top-3 right-6 rotate-[8deg]" />
        <Picture src={stop.image} alt={stop.name} className="aspect-[4/3] w-full" />
        <figcaption className="px-1 pt-3">
          <p className="font-hand text-2xl leading-none">{stop.name}</p>
          <p className="mt-1 text-sm text-muted">{stop.description}</p>
          {tip}
          {facts}
        </figcaption>
      </figure>
    );
  }
  return (
    <div className={cx("relative p-5 pt-6", stop.category === "food" ? "notepaper" : "bg-[#fff1a8] shadow-[0_14px_24px_-18px_rgba(60,40,10,.6)]")}>
      <span className="tape -top-3 left-6 -rotate-3" />
      <CategoryTag category={stop.category} />
      <p className="mt-2 font-display text-xl leading-snug">{stop.name}</p>
      <p className="mt-1 text-sm text-muted">{stop.description}</p>
      {tip}
      {facts}
    </div>
  );
}

function MapPage() {
  const { day, located } = useDay();
  return (
    <section className="relative mt-24">
      <h2 className="font-hand text-5xl font-bold">Our route</h2>
      <DayTabs variant="line" className="mt-4" />
      <div className="relative mt-6 bg-[#fffdf8] p-3 shadow-[0_18px_30px_-18px_rgba(60,40,10,.55)]">
        <span className="tape -top-3 left-10 z-[500] -rotate-6" />
        <span className="tape -top-3 right-10 z-[500] rotate-6" />
        <RouteMap stops={located} className="h-[26rem]" />
        <p className="pt-3 text-center font-hand text-2xl">Day {day.day}: {day.theme}</p>
      </div>
    </section>
  );
}

/** The budget printed as a shop receipt. */
function Receipt() {
  const { trip } = useTrip();
  const { budget, travellers } = trip;
  return (
    <div className="receipt rotate-1 p-6 pb-10 font-mono text-sm">
      <p className="text-center text-xs uppercase tracking-[0.3em]">Feel It travel co.</p>
      <p className="text-center text-[11px] text-muted">{trip.destination.label}</p>
      <div className="my-4 border-t border-dashed border-ink/30" />
      <ul className="space-y-1.5">
        {BUDGET_ROWS.filter(({ key }) => budget[key] > 0).map(({ key, label }) => (
          <li key={key} className="flex justify-between gap-3"><span className="uppercase">{label}</span><span>{inr(budget[key])}</span></li>
        ))}
      </ul>
      <div className="my-4 border-t border-dashed border-ink/30" />
      <p className="flex justify-between text-base font-bold"><span>TOTAL</span><span>{inr(budget.total)}</span></p>
      {travellers > 1 && <p className="flex justify-between text-muted"><span>PER PERSON</span><span>{inr(Math.round(budget.total / travellers))}</span></p>}
      <LimitNote className="mt-4 font-sans" />
      <p className="mt-5 text-center text-[11px] uppercase text-muted">AI estimate · thank you, come again</p>
    </div>
  );
}

function Packing() {
  const { items, packed, toggle, done } = usePacking();
  if (!items.length) return null;
  return (
    <div className="notepaper relative -rotate-1 p-6 pt-7">
      <span className="tape -top-3 left-1/2 -translate-x-1/2" />
      <p className="flex items-baseline justify-between font-hand text-3xl font-bold">Don't forget! <span className="text-xl text-muted">{done}/{items.length}</span></p>
      <ul className="mt-2 font-hand text-xl leading-[1.6rem]">
        {items.map((item) => (
          <li key={item}>
            <label className="flex cursor-pointer items-center gap-2">
              <input type="checkbox" checked={packed.includes(item)} onChange={() => toggle(item)} className="h-4 w-4 accent-[rgb(var(--tint-ink))]" />
              <span className={cx(packed.includes(item) && "text-muted line-through")}>{item}</span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Notes() {
  const { trip } = useTrip();
  if (!trip.tips.length) return null;
  return (
    <div className="relative rotate-1 bg-[#fff1a8] p-6 pt-7 shadow-[0_14px_24px_-18px_rgba(60,40,10,.6)]">
      <span className="tape -top-3 left-8 -rotate-3" />
      <p className="font-hand text-3xl font-bold">Local secrets</p>
      <ul className="mt-2 space-y-2 font-hand text-xl leading-snug">{trip.tips.map((tip) => <li key={tip}>→ {tip}</li>)}</ul>
    </div>
  );
}

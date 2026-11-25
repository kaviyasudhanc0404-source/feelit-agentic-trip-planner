import type { ReactNode } from "react";
import { Footprints, Users } from "lucide-react";
import { Picture } from "@/components/cards";
import { cx, inr, weatherIcon } from "@/lib/format";
import { places, totalKm } from "@/lib/tripStyle";
import {
  BudgetPanel, CategoryTag, Clock12, CoverPhoto, Countdown, DayStats, DayTabs, DayTools, Details, DestinationLink, EventsPanel, FoodPanel,
  Hop, JourneyPanel, LimitNote, PackingPanel, RouteMap, StayPanel, TipsPanel, useDay, useFacts, useTrip, WarningsPanel, WeatherPanel,
} from "./kit";

/** A bento board: the trip as tiles of different sizes, with the numbers (budget first) up front. */
export default function Bento({ actions }: { actions: ReactNode }) {
  const { trip, weather } = useTrip();
  const { day, located } = useDay();
  const facts = useFacts();
  const count = trip.days.reduce((sum, d) => sum + places(d.items).length, 0);
  const Sky = weatherIcon(weather?.current.code ?? 0);
  const dayPhotos = day.items.filter((stop) => stop.image).slice(0, 2);

  return (
    <div className="page [--radius:1.75rem]">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative isolate flex min-h-[20rem] flex-col justify-end overflow-hidden p-6 [border-radius:var(--radius)] sm:col-span-2 lg:row-span-2 lg:min-h-[24rem] sm:p-8">
          <CoverPhoto className="!absolute inset-0 -z-10" />
          <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-t from-night via-night/50 to-transparent" />
          <div className="flex flex-wrap items-center gap-2"><Countdown /><DestinationLink className="!text-snow/85" /></div>
          <h1 className="mt-3 text-4xl leading-none sm:text-5xl">{trip.title}</h1>
          <p className="mt-3 line-clamp-3 max-w-xl text-sm text-snow/75">{trip.summary}</p>
        </div>

        <Tile className="bg-gradient-to-br from-tint/25 via-tint2/10 to-transparent">
          <p className="eyebrow">Total estimate</p>
          <p className="mt-2 font-display text-5xl">{inr(trip.budget.total)}</p>
          <p className="font-mono text-[11px] text-muted">{trip.travellers > 1 ? `${inr(Math.round(trip.budget.total / trip.travellers))} per person` : "for you"}</p>
          <LimitNote className="mt-3" />
        </Tile>

        <Tile>
          <p className="eyebrow">Right now</p>
          {weather ? (
            <>
              <p className="mt-2 flex items-center gap-2 font-display text-5xl"><Sky className="h-9 w-9 text-gold" />{weather.current.temp}°</p>
              <p className="text-sm text-muted">{weather.current.label}{weather.current.aqi != null && ` · AQI ${weather.current.aqi}`}</p>
            </>
          ) : <div className="skeleton mt-3 h-16" />}
        </Tile>

        <Tile>
          <p className="eyebrow flex items-center gap-1.5"><Footprints className="h-3.5 w-3.5" />The trip</p>
          <p className="mt-2 font-display text-5xl">{count}<span className="ml-2 font-sans text-sm text-muted">places</span></p>
          <p className="text-sm text-muted">{trip.days.length} {trip.days.length > 1 ? "days" : "day"} · ~{Math.round(totalKm(trip))} km of road</p>
        </Tile>

        <Tile>
          <p className="eyebrow flex items-center gap-1.5"><Users className="h-3.5 w-3.5" />Who & how</p>
          <ul className="mt-2 space-y-1 text-sm capitalize">{facts.slice(1).map(({ icon: Icon, text }) => <li key={text} className="flex items-center gap-2"><Icon className="h-4 w-4 text-tint" />{text}</li>)}</ul>
          <p className="mt-1 text-xs text-muted">{facts[0].text}</p>
        </Tile>
      </section>

      {actions}

      <section className="mt-6 grid gap-3 lg:grid-flow-dense lg:grid-cols-4">
        <div className="panel min-w-0 p-5 lg:col-span-2 lg:row-span-3">
          <DayTabs />
          <h2 className="mt-5 text-3xl">{day.theme || `Day ${day.day}`}</h2>
          <DayTools day={day} className="mt-3" />
          <ol className="mt-5 divide-y divide-[color:var(--line)]">
            {day.items.map((stop) => (
              <li key={stop.id} className="py-3.5 first:pt-0">
                <Hop stop={stop} className="mb-2" />
                <div className="grid grid-cols-[4.25rem_1fr_auto] items-start gap-3">
                  <Clock12 time={stop.time} className="pt-0.5 text-sm font-semibold" />
                  <div className="min-w-0">
                    <p className="font-bold leading-snug">{stop.name}</p>
                    <CategoryTag category={stop.category} className="mt-1" />
                  </div>
                  <span className="pt-0.5 text-sm font-bold">{stop.cost_inr ? inr(stop.cost_inr) : "Free"}</span>
                </div>
                <Details stop={stop} className="ml-[5.5rem]" />
              </li>
            ))}
          </ol>
          <DayStats day={day} className="mt-4 border-t border-line pt-2" />
        </div>

        <div className="min-h-[20rem] overflow-hidden [border-radius:var(--radius)] ring-1 ring-white/10 lg:col-span-2 lg:row-span-2">
          <RouteMap stops={located} className="h-full min-h-[20rem]" />
        </div>

        {dayPhotos.map((stop) => (
          <div key={stop.id} className="group relative min-h-[12rem] overflow-hidden [border-radius:var(--radius)]">
            <Picture src={stop.image} alt={stop.name} className="absolute inset-0 h-full w-full transition duration-700 group-hover:scale-110" />
            <div className="absolute inset-0 bg-gradient-to-t from-night/90 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-4"><Clock12 time={stop.time} className="text-xs text-snow/80" /><p className="font-bold leading-snug text-snow">{stop.name}</p></div>
          </div>
        ))}

        <BudgetPanel variant="ring" className="lg:col-span-2" />
        <WeatherPanel className="lg:col-span-2" />
        <WarningsPanel className="lg:col-span-2" />
        <JourneyPanel className="lg:col-span-2" />
        <FoodPanel className="lg:col-span-2" />
        <StayPanel className="lg:col-span-2" />
        <EventsPanel className="lg:col-span-2" />
        <PackingPanel />
        <TipsPanel />
      </section>
    </div>
  );
}

function Tile({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("panel p-5", className)}>{children}</div>;
}

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Wallet } from "lucide-react";
import { Picture } from "@/components/cards";
import { cx, inr, weatherIcon } from "@/lib/format";
import { dayCost } from "@/lib/tripStyle";
import type { Stop } from "@/lib/types";
import {
  CategoryTag, Clock12, CoverPhoto, Countdown, DayStats, DayTabs, DayTools, DestinationLink, Extras, Hop, RouteMap, StopFacts, Tip,
  useDay, useFacts, useTrip,
} from "./kit";

/**
 * Map first: a big live map that follows the itinerary. Scrolling the timeline (or tapping a stop)
 * flies the map to that place; tapping a pin scrolls the timeline to it.
 */
export default function MapExplorer({ actions }: { actions: ReactNode }) {
  const { trip, weather } = useTrip();
  const { day, located } = useDay();
  const facts = useFacts();
  const [active, setActive] = useState<string | null>(null);
  const list = useRef<HTMLOListElement>(null);

  useEffect(() => setActive(null), [day]);

  // Follow the reader: the stop crossing the middle of the screen becomes the active one.
  useEffect(() => {
    const rows = list.current?.querySelectorAll<HTMLElement>("[data-stop]");
    if (!rows?.length) return;
    const watcher = new IntersectionObserver(
      (entries) => entries.forEach((entry) => entry.isIntersecting && setActive(entry.target.getAttribute("data-stop"))),
      { rootMargin: "-45% 0px -50% 0px" },
    );
    rows.forEach((row) => watcher.observe(row));
    return () => watcher.disconnect();
  }, [day]);

  const pickFromMap = (id: string) => {
    setActive(id);
    list.current?.querySelector(`[data-stop="${id}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const focus = day.items.find((stop) => stop.id === active && stop.lat != null) ?? located[0];
  const forecast = weather?.daily.find((row) => row.date === day.date);
  const Sky = weatherIcon(forecast?.code ?? weather?.current.code ?? 0);

  return (
    <>
      <header className="page">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <CoverPhoto className="h-24 w-24 shrink-0 rounded-3xl ring-1 ring-white/10 sm:h-28 sm:w-28 [&_a]:hidden" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2"><Countdown /><DestinationLink /></div>
            <h1 className="mt-2 text-4xl leading-none sm:text-5xl">{trip.title}</h1>
            <p className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm capitalize text-muted">
              {facts.map(({ icon: Icon, text }) => <span key={text} className="flex items-center gap-1.5"><Icon className="h-3.5 w-3.5 text-tint" />{text}</span>)}
            </p>
          </div>
        </div>
        <p className="mt-4 max-w-3xl text-muted">{trip.summary}</p>
        {actions}
      </header>

      <div className="mt-6 grid border-y border-line lg:grid-cols-[minmax(0,28rem)_1fr]">
        <div className="order-2 min-w-0 px-4 py-6 sm:px-6 lg:order-1 lg:border-r lg:border-line lg:px-8">
          <DayTabs />
          <h2 className="mt-6 text-3xl">{day.theme || `Day ${day.day}`}</h2>
          <DayTools day={day} className="mt-3" />
          <ol ref={list} className="mt-6 space-y-2">
            {day.items.map((stop) => (
              <li key={stop.id} data-stop={stop.id}>
                <Hop stop={stop} className="mb-1.5 pl-4" />
                <Item stop={stop} pin={located.indexOf(stop) + 1} on={stop.id === focus?.id} onClick={() => setActive(stop.id)} />
              </li>
            ))}
          </ol>
          <DayStats day={day} className="panel mt-6" />
        </div>

        <div className="sticky top-16 z-10 order-1 h-[38svh] lg:top-16 lg:order-2 lg:h-[calc(100svh-4rem)]">
          <RouteMap stops={located} active={focus?.id} onPick={pickFromMap} className="h-full" />
          <div className="pointer-events-none absolute inset-x-3 top-3 z-[500] flex justify-end gap-2">
            {(forecast || weather) && (
              <span className="glass-strong flex items-center gap-1.5 !rounded-full px-3 py-1.5 text-xs font-semibold text-snow">
                <Sky className="h-4 w-4 text-gold" />{forecast ? `${forecast.max}° · ${forecast.rain}% rain` : `${weather!.current.temp}°C now`}
              </span>
            )}
            <span className="glass-strong flex items-center gap-1.5 !rounded-full px-3 py-1.5 text-xs font-semibold text-snow">
              <Wallet className="h-4 w-4 text-tint" />Day ~{inr(dayCost(day.items))}
            </span>
          </div>
          {focus && <FocusCard stop={focus} />}
        </div>
      </div>

      <Extras className="page mt-12" />
    </>
  );
}

function Item({ stop, pin, on, onClick }: { stop: Stop; pin: number; on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cx("panel flex w-full items-start gap-3 p-3.5 text-left transition", on ? "!border-tint/60 !bg-tint/10" : "hover:!border-white/20")}
    >
      <span className={cx("mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-mono text-xs font-bold", pin ? "bg-gradient-to-br from-tint to-tint2 text-night" : "border border-line text-muted")}>{pin || "·"}</span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2"><Clock12 time={stop.time} className="text-xs text-muted" /><CategoryTag category={stop.category} /></span>
        <span className="mt-1 block font-bold leading-snug">{stop.name}</span>
        {on && (
          <span className="mt-1.5 block space-y-2 animate-rise">
            <span className="block text-sm text-muted">{stop.description}</span>
            <Tip text={stop.tip} />
            <StopFacts stop={stop} />
          </span>
        )}
      </span>
    </button>
  );
}

/** The highlighted stop, floating over the map. */
function FocusCard({ stop }: { stop: Stop }) {
  return (
    <div key={stop.id} className="glass-strong absolute bottom-4 left-4 z-[500] hidden w-80 overflow-hidden animate-rise sm:block">
      {stop.image && <Picture src={stop.image} alt={stop.name} className="h-36 w-full" />}
      <div className="p-4 text-snow">
        <div className="flex items-center gap-2"><Clock12 time={stop.time} className="text-sm" /><CategoryTag category={stop.category} /></div>
        <p className="mt-1.5 font-display text-xl leading-tight">{stop.name}</p>
        <p className="mt-1 line-clamp-2 text-xs text-mist">{stop.description}</p>
      </div>
    </div>
  );
}

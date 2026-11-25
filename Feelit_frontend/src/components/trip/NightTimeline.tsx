import type { ReactNode } from "react";
import { Picture } from "@/components/cards";
import { cx } from "@/lib/format";
import type { Stop } from "@/lib/types";
import {
  CategoryTag, Clock12, CoverPhoto, Countdown, DayStats, DayTabs, DayTools, DestinationLink, Extras, Hop, RouteMap, StopFacts, Tip,
  useDay, useFacts, useTrip, WeatherPanel,
} from "./kit";

/** The classic night layout: a vertical timeline with the map and weather beside it. */
export default function NightTimeline({ actions }: { actions: ReactNode }) {
  const { trip } = useTrip();
  const { day, located } = useDay();
  const facts = useFacts();

  return (
    <>
      <section className="page">
        <div className="relative isolate overflow-hidden rounded-[2rem] ring-1 ring-white/10">
          <CoverPhoto className="!absolute inset-0 -z-10" />
          <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-t from-night via-night/70 to-night/20" />
          <div className="px-6 pb-7 pt-32 sm:px-10 sm:pt-44">
            <div className="flex flex-wrap items-center gap-2"><Countdown /><DestinationLink className="!text-snow/80" /></div>
            <h1 className="mt-3 max-w-3xl text-4xl leading-none sm:text-6xl">{trip.title}</h1>
            <p className="mt-3 max-w-2xl text-snow/75">{trip.summary}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {facts.map(({ icon: Icon, text }) => <span key={text} className="chip capitalize"><Icon className="h-3.5 w-3.5" />{text}</span>)}
            </div>
          </div>
        </div>
        {actions}
      </section>

      <div className="page mt-6 grid gap-6 lg:grid-cols-[1fr_23rem]">
        <div className="min-w-0">
          <DayTabs />
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-3xl">{day.theme || `Day ${day.day}`}</h2>
            <DayTools day={day} />
          </div>
          <ol className="mt-6">
            {day.items.map((stop, index) => <Row key={stop.id} stop={stop} pin={located.indexOf(stop) + 1} last={index === day.items.length - 1} />)}
          </ol>
          <DayStats day={day} className="panel mt-1 sm:ml-[6.25rem]" />
        </div>
        <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
          <div className="overflow-hidden rounded-3xl ring-1 ring-white/10"><RouteMap stops={located} /></div>
          <WeatherPanel />
        </aside>
      </div>

      <Extras className="page mt-8" skip={["weather"]} />
    </>
  );
}

function Row({ stop, pin, last }: { stop: Stop; pin: number; last: boolean }) {
  return (
    <li className="grid grid-cols-[3.5rem_1.75rem_1fr] gap-x-2 animate-rise">
      <Clock12 time={stop.time} className="pt-4 text-right text-sm font-semibold" />
      <div className="flex flex-col items-center">
        <span className={cx("mt-3.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-[11px] font-bold", pin ? "bg-gradient-to-br from-tint to-tint2 text-night" : "border border-line text-muted")}>{pin || "·"}</span>
        {!last && <span className="w-px flex-1 bg-gradient-to-b from-white/25 to-white/5" />}
      </div>
      <div className="pb-5">
        <Hop stop={stop} className="mb-1.5" />
        <article className="panel flex overflow-hidden transition hover:border-white/20">
          {stop.image && <Picture src={stop.image} alt={stop.name} className="hidden w-32 shrink-0 sm:block" />}
          <div className="min-w-0 flex-1 p-4">
            <div className="flex flex-wrap items-center gap-2"><CategoryTag category={stop.category} /><h3 className="font-sans text-base font-bold">{stop.name}</h3></div>
            <p className="mt-1 text-sm text-muted">{stop.description}</p>
            <Tip text={stop.tip} className="mt-2" />
            <StopFacts stop={stop} className="mt-3" />
          </div>
        </article>
      </div>
    </li>
  );
}

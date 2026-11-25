import type { ReactNode } from "react";
import { ArrowDown, TrainFront } from "lucide-react";
import { Picture } from "@/components/cards";
import { DayWeather } from "@/components/Weather";
import { cx, duration, inr, shortDate } from "@/lib/format";
import { dayKm, places, totalKm } from "@/lib/tripStyle";
import type { Day, Stop } from "@/lib/types";
import {
  CategoryTag, Clock12, CoverPhoto, Countdown, DayStats, DayTabs, DayTools, DestinationLink, Extras, FloatingWidgets, Gallery, Hop,
  RouteMap, StopFacts, Tip, useDay, useFacts, useTrip,
} from "./kit";

/** A travel magazine: full-bleed photography, an editorial intro, and each day told as a chapter. */
export default function Cinematic({ actions }: { actions: ReactNode }) {
  const { trip } = useTrip();
  const facts = useFacts();
  const openChapter = (day: number) => document.getElementById(`chapter-${day}`)?.scrollIntoView({ behavior: "smooth" });

  return (
    <>
      <header className="relative isolate -mt-4 flex h-[calc(100svh-4rem)] min-h-[34rem] items-end overflow-hidden lg:-mt-8">
        <CoverPhoto className="!absolute inset-0 -z-10" imgClassName="animate-kenburns" />
        <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-t from-night via-night/40 to-night/10" />
        <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-r from-night/70 to-transparent" />
        <div className="page pb-12 sm:pb-16">
          <div className="flex flex-wrap items-center gap-3"><Countdown /><DestinationLink className="!text-snow/85" /></div>
          <h1 className="mt-4 max-w-5xl text-5xl leading-[0.92] sm:text-7xl lg:text-8xl">{trip.title}</h1>
          <p className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold capitalize text-snow/80">
            {facts.map(({ icon: Icon, text }) => <span key={text} className="flex items-center gap-1.5"><Icon className="h-4 w-4 text-tint" />{text}</span>)}
          </p>
          <button onClick={() => openChapter(1)} className="tap no-print mt-10 inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-snow/70 hover:text-snow">
            <ArrowDown className="h-4 w-4 animate-float" />Begin the journey
          </button>
        </div>
      </header>

      <div className="page">{actions}</div>

      <section className="page mt-16 grid gap-12 lg:grid-cols-[1.5fr_1fr]">
        <p className="font-display text-2xl leading-relaxed text-ink/90 sm:text-[2rem] sm:leading-[1.45] first-letter:float-left first-letter:mr-3 first-letter:mt-1 first-letter:text-[4.5rem] first-letter:leading-[0.8] first-letter:text-tint">
          {trip.summary}
        </p>
        <dl className="self-start border-t border-line">
          {[
            ...facts.map(({ label, text }) => [label, text]),
            ["Places", `${trip.days.reduce((sum, d) => sum + places(d.items).length, 0)} across ${trip.days.length} ${trip.days.length > 1 ? "days" : "day"}`],
            ["Distance", `~${Math.round(totalKm(trip))} km between stops`],
            ["Estimate", inr(trip.budget.total)],
          ].map(([label, text]) => (
            <div key={label} className="flex items-baseline justify-between gap-6 border-b border-line py-3">
              <dt className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">{label}</dt>
              <dd className="text-right text-sm font-semibold capitalize">{text}</dd>
            </div>
          ))}
        </dl>
      </section>

      <Gallery className="page mt-16" onOpenDay={openChapter} />

      {trip.days.map((day) => <Chapter key={day.day} day={day} />)}

      <RouteSection />
      <Extras className="page mt-16" />
      <FloatingWidgets />
    </>
  );
}

function Chapter({ day }: { day: Day }) {
  const { weather } = useTrip();
  const lead = day.items.find((stop) => stop.image);
  return (
    <section id={`chapter-${day.day}`} className="mt-24 scroll-mt-20">
      <div className="relative isolate flex h-[62svh] min-h-[22rem] items-end overflow-hidden">
        {lead ? (
          <Picture src={lead.image} alt={lead.name} className="absolute inset-0 -z-10 h-full w-full" />
        ) : (
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_30%_20%,rgb(var(--tint)/0.35),transparent_60%),radial-gradient(ellipse_at_80%_80%,rgb(var(--tint-2)/0.3),transparent_55%)]" />
        )}
        <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-t from-night via-night/30 to-transparent" />
        <div className="page pb-10">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-tint">Chapter {String(day.day).padStart(2, "0")}</p>
          <h2 className="mt-2 max-w-3xl text-4xl leading-none sm:text-6xl">{day.theme || `Day ${day.day}`}</h2>
          <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-snow/80">
            {shortDate(day.date)} <DayWeather weather={weather} date={day.date} />
            <span className="font-mono text-[11px]">{places(day.items).length} places · ~{dayKm(day.items)} km</span>
          </p>
        </div>
      </div>

      <div className="page">
        <DayTools day={day} className="mt-6" />
        <ol className="mt-10 space-y-12 sm:space-y-16">
          {day.items.map((stop, index) => <Scene key={stop.id} stop={stop} flip={index % 2 === 1} />)}
        </ol>
        <DayStats day={day} className="panel mx-auto mt-14 max-w-xl" />
      </div>
    </section>
  );
}

/** One stop: photographed stops get a big alternating image; the rest a quiet column. */
function Scene({ stop, flip }: { stop: Stop; flip: boolean }) {
  if (stop.category === "travel") {
    return (
      <li className="mx-auto flex max-w-3xl items-center gap-4 border-y border-dashed border-line py-5 animate-rise">
        <TrainFront className="h-6 w-6 shrink-0 text-tint" />
        <div className="min-w-0 flex-1">
          <p className="font-display text-xl">{stop.name}</p>
          <p className="text-sm text-muted">{stop.description}</p>
        </div>
        <div className="shrink-0 text-right">
          <Clock12 time={stop.time} className="text-lg" />
          <p className="font-mono text-[11px] text-muted">{duration(stop.duration_min)}{stop.cost_inr ? ` · ~${inr(stop.cost_inr)}` : ""}</p>
        </div>
      </li>
    );
  }

  const text = (
    <div className="min-w-0">
      <Hop stop={stop} className="mb-3" />
      <div className="flex items-center gap-3"><Clock12 time={stop.time} className="font-display text-3xl text-tint" /><CategoryTag category={stop.category} /></div>
      <h3 className="mt-3 text-3xl leading-tight sm:text-4xl">{stop.name}</h3>
      <p className="mt-3 max-w-lg text-base text-muted">{stop.description}</p>
      <Tip text={stop.tip} className="mt-3 text-sm" />
      <StopFacts stop={stop} className="mt-4" />
    </div>
  );

  if (!stop.image) return <li className="mx-auto max-w-2xl border-l-2 border-tint/60 pl-6 animate-rise">{text}</li>;
  return (
    <li className="grid items-center gap-8 animate-rise md:grid-cols-2 md:gap-14">
      <div className={cx("group overflow-hidden [border-radius:var(--radius)]", flip && "md:order-2")}>
        <Picture src={stop.image} alt={stop.name} className="aspect-[4/3] w-full transition duration-[1.2s] group-hover:scale-105" />
      </div>
      {text}
    </li>
  );
}

function RouteSection() {
  const { day, located } = useDay();
  return (
    <section className="page mt-24">
      <p className="eyebrow">The route</p>
      <h2 className="mt-2 text-4xl">Day {day.day} on the map</h2>
      <DayTabs className="mt-6" />
      <div className="mt-4 overflow-hidden [border-radius:var(--radius)] ring-1 ring-white/10">
        <RouteMap stops={located} className="h-[60svh] min-h-[20rem]" />
      </div>
    </section>
  );
}

import type { ReactNode } from "react";
import { Picture } from "@/components/cards";
import { DayWeather } from "@/components/Weather";
import { inr, shortDate } from "@/lib/format";
import { dayCost, places } from "@/lib/tripStyle";
import type { Day, Stop } from "@/lib/types";
import { Clock12, CoverPhoto, Countdown, DayTabs, DayTools, Details, DestinationLink, Extras, Hop, RouteMap, useDay, useFacts, useTrip } from "./kit";

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV"];

/** Minimal luxury: warm ivory paper, light serif type, generous space and details on request. */
export default function Luxury({ actions }: { actions: ReactNode }) {
  const { trip } = useTrip();
  const facts = useFacts();

  return (
    <div className="page">
      <section className="grid items-end gap-12 pb-10 pt-6 lg:grid-cols-[1fr_0.85fr] lg:pt-14">
        <div>
          <DestinationLink className="!tracking-[0.35em]" />
          <h1 className="mt-6 text-5xl font-light leading-[0.95] sm:text-7xl">{trip.title}</h1>
          <div className="mt-8 h-px w-24 bg-tintink" />
          <p className="mt-8 max-w-lg text-lg leading-relaxed text-muted">{trip.summary}</p>
          <dl className="mt-10 grid max-w-lg grid-cols-3 border-t border-line">
            {facts.map(({ label, text }) => (
              <div key={label} className="border-r border-line py-4 pr-4 last:border-0 [&:not(:first-child)]:pl-4">
                <dt className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted">{label}</dt>
                <dd className="mt-1 text-sm capitalize">{text}</dd>
              </div>
            ))}
          </dl>
          <Countdown className="mt-6 !bg-ink !text-[#f6f1e9]" />
        </div>
        <CoverPhoto className="aspect-[4/5] w-full [border-radius:var(--radius)]" />
      </section>

      {actions}

      <div className="mt-10">{trip.days.map((day) => <DaySection key={day.day} day={day} />)}</div>

      <RouteSection />

      <section className="mt-24 border-t border-line pt-16">
        <p className="eyebrow !tracking-[0.35em]">Concierge notes</p>
        <h2 className="mt-4 text-4xl font-light">Everything else, quietly arranged</h2>
        <Extras className="mt-10" columns="md:columns-2" />
      </section>
    </div>
  );
}

function DaySection({ day }: { day: Day }) {
  const { weather } = useTrip();
  const feature = day.items.find((stop) => stop.image);
  return (
    <section className="grid gap-10 border-t border-line py-16 lg:grid-cols-[15rem_1fr]">
      <header className="lg:sticky lg:top-24 lg:self-start">
        <p className="font-display text-7xl font-light leading-none text-tintink">{ROMAN[day.day - 1] ?? day.day}</p>
        <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.25em] text-muted">{shortDate(day.date)}</p>
        <h2 className="mt-2 font-display text-2xl font-light italic leading-snug">{day.theme}</h2>
        <p className="mt-3 text-muted"><DayWeather weather={weather} date={day.date} /></p>
        <p className="mt-3 font-mono text-[11px] text-muted">{places(day.items).length} places · ~{inr(dayCost(day.items))}</p>
        <DayTools day={day} className="mt-5" />
      </header>
      <ol>
        {day.items.map((stop) => <Entry key={stop.id} stop={stop} featured={stop === feature} />)}
      </ol>
    </section>
  );
}

function Entry({ stop, featured }: { stop: Stop; featured: boolean }) {
  return (
    <li className="grid gap-x-8 gap-y-2 border-b border-line py-7 first:pt-0 last:border-0 sm:grid-cols-[6rem_1fr] animate-rise">
      <Clock12 time={stop.time} className="pt-1.5 text-sm tracking-wide text-muted" />
      <div className="min-w-0">
        <Hop stop={stop} className="mb-2" />
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-tintink">{stop.category === "travel" ? "Journey" : stop.category === "food" ? "Table" : stop.category}</p>
        <h3 className="mt-1 text-2xl font-normal leading-snug sm:text-3xl">{stop.name}</h3>
        {featured && stop.image && <Picture src={stop.image} alt={stop.name} className="mt-5 aspect-[16/9] w-full [border-radius:var(--radius)]" />}
        <Details stop={stop} />
      </div>
    </li>
  );
}

function RouteSection() {
  const { day, located } = useDay();
  return (
    <section className="border-t border-line pt-16">
      <p className="eyebrow !tracking-[0.35em]">The route</p>
      <h2 className="mt-4 text-4xl font-light">Day {ROMAN[day.day - 1] ?? day.day}, mapped</h2>
      <DayTabs variant="line" className="mt-8" />
      <div className="mt-6 border border-line p-2">
        <RouteMap stops={located} className="h-[28rem]" />
      </div>
    </section>
  );
}

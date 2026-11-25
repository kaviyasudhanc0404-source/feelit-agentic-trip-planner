import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CalendarDays, Pencil, Plane, Plus, Trash2, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { Picture } from "@/components/cards";
import { ConfirmButton } from "@/components/ConfirmButton";
import { api } from "@/lib/api";
import { countdown, cx, dateRange, daysBetween, inr, todayIso, tripLength } from "@/lib/format";
import { useDeleteTrip } from "@/lib/trips";
import type { TripCard } from "@/lib/types";

export default function Trips() {
  const { data: trips, isLoading, error } = useQuery({ queryKey: ["trips"], queryFn: api.trips });
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");
  const today = todayIso();
  const upcoming = trips?.filter((t) => t.end_date >= today) ?? [];
  const past = (trips?.filter((t) => t.end_date < today) ?? []).reverse();
  const shown = tab === "upcoming" ? upcoming : past;
  const [featured, ...rest] = shown;
  const days = (trips ?? []).reduce((sum, t) => sum + daysBetween(t.start_date, t.end_date) + 1, 0);

  return (
    <div className="page py-2 sm:py-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Your journeys</p>
          <h1 className="mt-2 text-5xl sm:text-6xl">My <span className="accent">trips</span></h1>
          {trips && <p className="mt-2 font-mono text-xs text-mist">{trips.length} trips · {days} days of travel · {new Set(trips.map((t) => t.destination.label)).size} places</p>}
        </div>
        <Link to="/plan" className="btn btn-primary"><Plus className="h-4 w-4" />Plan a new trip</Link>
      </div>

      <div className="mt-8 flex gap-6 border-b border-white/10">
        {([["upcoming", upcoming.length], ["past", past.length]] as const).map(([key, count]) => (
          <button key={key} onClick={() => setTab(key)} className={cx("-mb-px border-b-2 pb-3 text-sm font-bold capitalize transition", tab === key ? "border-saffron text-snow" : "border-transparent text-mist hover:text-snow")}>
            {key} <span className="font-mono text-xs opacity-60">{count}</span>
          </button>
        ))}
      </div>

      {error && <p className="glass mt-6 p-5 text-sm text-coral">{error.message}</p>}
      {isLoading && <div className="mt-6 space-y-4"><div className="skeleton h-80" /><div className="skeleton h-40" /></div>}

      {featured && <Featured trip={featured} />}
      {rest.length > 0 && (
        <>
          <p className="rule mt-12">{tab === "upcoming" ? "Also coming up" : "Earlier trips"}</p>
          <div className="mt-5 space-y-4">{rest.map((trip, i) => <Pass key={trip.id} trip={trip} index={i} />)}</div>
        </>
      )}

      {trips && !shown.length && (
        <div className="mx-auto mt-14 max-w-xl text-center">
          <Plane className="mx-auto h-10 w-10 -rotate-12 text-saffron" />
          <h2 className="mt-4 text-4xl">{tab === "upcoming" ? <>Your next trip is <span className="accent">one chat</span> away</> : "No past trips yet"}</h2>
          <p className="mt-2 text-mist">Tell Feel It where you'd like to go. It'll ask a few questions and plan the rest.</p>
          <Link to="/plan" className="btn btn-primary mt-6">Start planning</Link>
        </div>
      )}
    </div>
  );
}

function Actions({ trip }: { trip: TripCard }) {
  const remove = useDeleteTrip();
  return (
    <span className="flex items-center gap-2">
      <Link to={`/trips/${trip.id}?edit=1`} className="btn-icon" aria-label={`Edit ${trip.title}`} title="Edit"><Pencil className="h-4 w-4" /></Link>
      <ConfirmButton className="btn-icon hover:text-coral" busy={remove.isPending} onConfirm={() => remove.mutate(trip.id)}>
        <Trash2 className="h-4 w-4" aria-label={`Delete ${trip.title}`} />
      </ConfirmButton>
    </span>
  );
}

/** The soonest trip, shown large. */
function Featured({ trip }: { trip: TripCard }) {
  return (
    <article className="mt-8 grid overflow-hidden rounded-[1.25rem] border border-white/10 bg-[#0e1426] animate-rise lg:grid-cols-[1.35fr_1fr]">
      <Link to={`/trips/${trip.id}`} className="group relative block min-h-[16rem] overflow-hidden lg:min-h-[22rem]">
        <Picture src={trip.cover?.url} alt={trip.destination.name} className="absolute inset-0 h-full w-full transition duration-700 group-hover:scale-105" />
        <span className="absolute left-5 top-5 rounded-full bg-saffron px-3 py-1 font-mono text-[11px] font-bold uppercase text-night">{countdown(trip.start_date, trip.end_date)}</span>
      </Link>
      <div className="flex flex-col p-6 sm:p-8">
        <p className="eyebrow">{trip.destination.label}</p>
        <Link to={`/trips/${trip.id}`}><h2 className="mt-3 text-4xl leading-tight hover:text-saffron">{trip.title}</h2></Link>
        <p className="mt-3 line-clamp-3 text-sm text-mist">{trip.summary}</p>
        <dl className="mt-6 grid grid-cols-3 gap-4 border-y border-white/10 py-4 text-sm">
          <div><dt className="label">Dates</dt><dd>{dateRange(trip.start_date, trip.end_date)}</dd></div>
          <div><dt className="label">Guests</dt><dd>{trip.travellers}</dd></div>
          <div><dt className="label">Budget</dt><dd>{inr(trip.budget.total)}</dd></div>
        </dl>
        <div className="mt-auto flex items-center justify-between gap-3 pt-6">
          <Link to={`/trips/${trip.id}`} className="btn btn-primary">Open trip <ArrowRight className="h-4 w-4" /></Link>
          <Actions trip={trip} />
        </div>
      </div>
    </article>
  );
}

/** Any other trip, as a horizontal boarding pass with a tear-off stub. */
function Pass({ trip, index }: { trip: TripCard; index: number }) {
  return (
    <article className="group relative grid overflow-hidden rounded-[1.25rem] border border-white/10 bg-[#0e1426] animate-rise sm:grid-cols-[11rem_1fr_auto]" style={{ animationDelay: `${index * 50}ms` }}>
      <Link to={`/trips/${trip.id}`} className="relative block h-36 overflow-hidden sm:h-auto">
        <Picture src={trip.cover?.url} alt={trip.destination.name} className="absolute inset-0 h-full w-full transition duration-700 group-hover:scale-105" />
      </Link>
      <div className="min-w-0 p-5">
        <p className="font-mono text-[10px] uppercase tracking-widest text-mist">{trip.destination.name} · {tripLength(trip.start_date, trip.end_date)}</p>
        <Link to={`/trips/${trip.id}`}><h3 className="mt-1 text-2xl leading-tight hover:text-saffron">{trip.title}</h3></Link>
        <p className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-mist">
          <span className="flex items-center gap-1.5"><CalendarDays className="h-4 w-4" />{dateRange(trip.start_date, trip.end_date)}</span>
          <span className="flex items-center gap-1.5"><Users className="h-4 w-4" />{trip.travellers}</span>
        </p>
      </div>
      <div className="relative flex items-center justify-between gap-4 border-t-2 border-dashed border-white/10 p-5 sm:flex-col sm:items-end sm:justify-center sm:border-l-2 sm:border-t-0">
        <span className="absolute -top-3 left-[-0.75rem] hidden h-6 w-6 rounded-full bg-night sm:-left-3 sm:block" />
        <span className="absolute -bottom-3 -left-3 hidden h-6 w-6 rounded-full bg-night sm:block" />
        <div className="sm:text-right">
          <span className="font-mono text-[10px] font-bold uppercase text-saffron">{countdown(trip.start_date, trip.end_date)}</span>
          <p className="font-display text-2xl">{inr(trip.budget.total)}</p>
        </div>
        <Actions trip={trip} />
      </div>
    </article>
  );
}

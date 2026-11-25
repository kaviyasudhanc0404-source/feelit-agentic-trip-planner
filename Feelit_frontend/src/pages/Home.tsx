import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CalendarHeart, CloudSun, Compass, Globe, Heart, IndianRupee, Map, MapPin, MessageCircleQuestion, Mountain, Pencil, Plane, Sunrise, Wallet } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { DestinationBento, DestinationCard, SectionTitle } from "@/components/cards";
import { Composer } from "@/components/Composer";
import { PlaceInput } from "@/components/PlaceInput";
import { PostcardStream, useTrending } from "@/components/Postcards";
import { SlideRow } from "@/components/SlideRow";
import { useAuth } from "@/context/auth";
import { useConversation } from "@/context/conversation";
import { api } from "@/lib/api";
import { countdown, cx, dateRange, inr, todayIso, tripLength } from "@/lib/format";
import { useStoredState } from "@/lib/storage";


const STARTERS = [
  { icon: Mountain, label: "Munnar, 3 days", prompt: "Plan a 3-day trip to Munnar from Chennai" },
  { icon: Sunrise, label: "Day trip near me", prompt: "A one-day trip near me this Sunday" },
  { icon: CalendarHeart, label: "Weekend getaways", prompt: "Best weekend getaways from Bengaluru in December" },
  { icon: Heart, label: "Romantic Udaipur", prompt: "Romantic 4 days in Udaipur, luxury" },
];

const STEPS = [
  { title: "Tell it", text: "Where, roughly when, and what kind of trip. Type or speak." },
  { title: "It asks", text: "Budget, food, pace, who's coming: the questions a good planner asks." },
  { title: "It checks", text: "Trending spots, festivals, 16-day weather and real map positions." },
  { title: "You shape it", text: "Edit by hand or just tell the agent what to change." },
];

const SKILLS = [
  { icon: MessageCircleQuestion, title: "Asks like a planner", text: "Budget, food, pace, who's coming — it asks what matters before it plans." },
  { icon: Globe, title: "Reads the live web", text: "Trending spots, ticket prices, festivals and timings, with sources you can open." },
  { icon: CloudSun, title: "Watches the weather", text: "Live forecasts and air quality shape every day of your plan." },
  { icon: Map, title: "Maps every stop", text: "Real places on a map, ordered so you don't zig-zag across town." },
  { icon: Wallet, title: "Budgets in rupees", text: "Stay, food, transport and tickets — checked against your limit." },
  { icon: Pencil, title: "Edits on request", text: "Change anything by hand, or just tell the agent what to change." },
];

export default function Home() {
  const navigate = useNavigate();
  const { send } = useConversation();
  const start = (text: string) => {
    send(text);
    navigate("/plan");
  };

  return (
    <>
      <MobileHero onStart={start} />
      <section className="page hidden items-center gap-10 pt-6 lg:grid lg:grid-cols-[1.2fr_0.8fr]">
        <div className="animate-rise">
          <HeroCopy />
          <HeroAsk onStart={start} placeholder="e.g. Plan a trip to Kodaikanal for my parents" className="mt-8" />
        </div>
        <PostcardStream className="h-[38rem]" />
      </section>
      <PostcardStream direction="horizontal" className="mt-6 lg:hidden" />

      <section className="page mt-16 lg:mt-20">
        <p className="rule">How Feel It plans</p>
        <SlideRow
          items={STEPS}
          label={(step, i) => `Step ${i + 1}: ${step.title}`}
          className="mt-6 sm:grid sm:grid-cols-2 sm:gap-px sm:overflow-hidden sm:rounded-[1.25rem] sm:bg-white/[0.07] lg:grid-cols-4"
          itemClassName="rounded-[1.25rem] border border-white/10 bg-[#0e1426] p-6 sm:rounded-none sm:border-0 sm:bg-night"
          render={({ title, text }, i) => (
            <>
              <span className="font-display text-5xl text-saffron/80">0{i + 1}</span>
              <h3 className="mt-4 font-sans text-base font-bold">{title}</h3>
              <p className="mt-1 text-sm text-mist">{text}</p>
            </>
          )}
        />
      </section>

      <section className="page mt-20 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <ExploreBand />
        <NextTrip />
      </section>

      <Trending />

      <section className="page mt-24">
        <SectionTitle eyebrow="What the agent does">An expert planner that <span className="accent">never sleeps</span></SectionTitle>
        <SlideRow
          items={SKILLS}
          label={(skill) => skill.title}
          className="sm:grid sm:grid-cols-2 sm:border-t sm:border-white/10"
          itemClassName="group rounded-[1.25rem] border border-white/10 bg-gradient-to-br from-[#121a30] to-[#0b1020] p-6 sm:flex sm:gap-5 sm:rounded-none sm:border-0 sm:border-b sm:border-white/10 sm:bg-none sm:px-0 sm:py-6 sm:odd:pr-10 sm:even:border-l sm:even:pl-10"
          render={({ icon: Icon, title, text }, i) => (
            <>
              <span className="flex items-center justify-between sm:block">
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-saffron/10 text-saffron sm:hidden"><Icon className="h-6 w-6" /></span>
                <span className="font-mono text-xs text-mist">0{i + 1}</span>
              </span>
              <div className="mt-6 sm:mt-0">
                <h3 className="flex items-center gap-2 font-display text-2xl"><Icon className="hidden h-5 w-5 text-saffron transition group-hover:rotate-12 sm:block" />{title}</h3>
                <p className="mt-1 text-sm text-mist">{text}</p>
              </div>
            </>
          )}
        />
      </section>
    </>
  );
}

function HeroCopy({ compact = false }: { compact?: boolean }) {
  return (
    <>
      <p className="eyebrow flex items-center gap-2"><span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-peacock" />AI travel agent · India<span className="hidden sm:inline"> · live data</span></p>
      <h1 className={cx("mt-4 leading-[0.95]", compact ? "text-[2.75rem] sm:text-6xl" : "text-7xl xl:text-[5.5rem]")}>
        Where do you want to <span className="accent">feel</span> next?
      </h1>
      <p className={cx("max-w-xl", compact ? "mt-4 text-[15px] text-snow/80" : "mt-6 text-lg text-mist")}>
        Tell Feel It about your trip. It asks the right questions, reads what's trending right now, and builds a plan you can edit.
      </p>
    </>
  );
}

/** The message bar plus quick ideas, shared by the phone and laptop heroes. */
function HeroAsk({ onStart, placeholder, className, autoFocus = true }: { onStart: (text: string) => void; placeholder: string; className?: string; autoFocus?: boolean }) {
  return (
    <div className={className}>
      <Composer large autoFocus={autoFocus} placeholder={placeholder} onSend={onStart} />
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {STARTERS.map(({ icon: Icon, label, prompt }) => (
          <button key={label} onClick={() => onStart(prompt)} className="chip shrink-0 py-1.5 backdrop-blur hover:bg-white/10">
            <Icon className="h-3.5 w-3.5 text-saffron" />{label}
          </button>
        ))}
      </div>
    </div>
  );
}

const REDUCED_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Phones: a full-screen hero over a slow slideshow of what's trending, named in the corner. */
function MobileHero({ onStart }: { onStart: (text: string) => void }) {
  const { data } = useTrending();
  const slides = (data?.web ?? []).filter((place) => place.cover.url).slice(0, 6);
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (slides.length < 2 || REDUCED_MOTION) return;
    const timer = window.setInterval(() => setIndex((i) => (i + 1) % slides.length), 5000);
    return () => window.clearInterval(timer);
  }, [slides.length]);
  const current = slides[index % Math.max(slides.length, 1)];

  return (
    <section className="relative isolate -mt-4 flex min-h-[calc(100svh-4rem)] flex-col justify-end overflow-hidden px-4 pb-28 pt-16 sm:px-6 lg:hidden">
      <div className="absolute inset-0 -z-10" aria-hidden>
        {slides.length ? (
          slides.map((place, i) => (
            <img
              key={place.name}
              src={place.cover.url!}
              alt=""
              loading={i === 0 ? "eager" : "lazy"}
              className={cx("absolute inset-0 h-full w-full object-cover transition-opacity duration-[1200ms]", i === index ? "animate-kenburns opacity-100" : "opacity-0")}
            />
          ))
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,rgba(255,159,69,.35),transparent_60%),radial-gradient(ellipse_at_80%_70%,rgba(34,195,181,.25),transparent_55%)]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-night via-night/75 to-night/10" />
      </div>
      {current && (
        <Link
          to={`/explore/${encodeURIComponent(`${current.name}, ${current.state}`)}`}
          className="absolute right-4 top-5 flex items-center gap-1.5 rounded-full bg-night/55 px-3 py-1.5 text-xs font-semibold text-snow backdrop-blur sm:right-6"
        >
          <MapPin className="h-3.5 w-3.5 text-saffron" />{current.name}<span className="text-snow/60">· trending</span>
        </Link>
      )}
      <div className="animate-rise">
        <HeroCopy compact />
        <HeroAsk onStart={onStart} placeholder="Where do you want to go?" autoFocus={false} className="mt-6" />
      </div>
    </section>
  );
}

function ExploreBand() {
  const navigate = useNavigate();
  return (
    <div className="glass relative overflow-hidden p-6 sm:p-8">
      <Compass className="absolute -right-10 -top-10 h-56 w-56 text-white/[0.03]" />
      <p className="eyebrow !text-peacock">Explore</p>
      <h2 className="mt-2 text-3xl sm:text-4xl">See what's worth visiting, anywhere in India</h2>
      <p className="mt-2 text-sm text-mist">Type any town, hill station or city — or use where you are right now.</p>
      <div className="mt-6">
        <PlaceInput large placeholder="Search a place, e.g. Hampi, Coorg" onPick={(place) => navigate(`/explore/${encodeURIComponent(place.label)}`)} onLocate={() => navigate("/explore?near=1")} />
      </div>
    </div>
  );
}

/** The next upcoming trip as a boarding pass, or an invitation to plan one. */
function NextTrip() {
  const { user } = useAuth();
  const { data: trips } = useQuery({ queryKey: ["trips"], queryFn: api.trips, enabled: Boolean(user) });
  const next = trips?.find((trip) => trip.end_date >= todayIso());

  if (!next) {
    return (
      <Link to={user ? "/plan" : "/auth"} className="glass group flex flex-col justify-between p-6 transition hover:border-saffron/40 sm:p-8">
        <Plane className="h-8 w-8 -rotate-12 text-saffron transition group-hover:translate-x-2 group-hover:-translate-y-1" />
        <div className="mt-8">
          <h2 className="text-2xl">{user ? "No trip on the horizon yet" : "Save every trip you plan"}</h2>
          <p className="mt-1 text-sm text-mist">{user ? "Start a chat and your next escape will appear here." : "Sign in to keep, edit and share your plans."}</p>
          <span className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-saffron">{user ? "Plan one now" : "Sign in"} <ArrowRight className="h-4 w-4" /></span>
        </div>
      </Link>
    );
  }
  return (
    <Link to={`/trips/${next.id}`} className="group grid grid-cols-[1fr_auto] overflow-hidden rounded-[1.25rem] bg-snow text-night transition hover:-translate-y-1">
      <div className="p-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-night/50">Your next trip · boarding pass</p>
        <h2 className="mt-3 text-3xl leading-tight">{next.title}</h2>
        <p className="mt-1 text-sm text-night/60">{next.destination.name} · {dateRange(next.start_date, next.end_date)}</p>
        <div className="mt-5 grid grid-cols-3 gap-3 font-mono text-[11px] uppercase">
          <span><span className="block text-night/45">Length</span>{tripLength(next.start_date, next.end_date)}</span>
          <span><span className="block text-night/45">Guests</span>{next.travellers}</span>
          <span><span className="block text-night/45">Budget</span><IndianRupee className="inline h-3 w-3" />{inr(next.budget.total).replace("₹", "")}</span>
        </div>
      </div>
      <div className="flex w-24 flex-col items-center justify-center gap-2 border-l-2 border-dashed border-night/20 bg-saffron px-2 text-center">
        <span className="font-display text-sm font-semibold leading-tight">{countdown(next.start_date, next.end_date)}</span>
        <ArrowRight className="h-5 w-5 transition group-hover:translate-x-1" />
      </div>
    </Link>
  );
}

const HIDDEN_KEY = "feelit_hidden_places";

/** Places this viewer removed from "Where travellers are heading", remembered on this device. */
function useHiddenPlaces() {
  const [hidden, save] = useStoredState<string[]>(HIDDEN_KEY, []);
  return { hidden, hide: (name: string) => save([...hidden, name]), restore: () => save([]) };
}

/** Trending from the live web as a bento mosaic, then where Feel It travellers are heading. */
export function Trending() {
  const { data, isLoading } = useTrending();
  const { hidden, hide, restore } = useHiddenPlaces();
  const all = data?.travellers ?? [];
  const travellers = all.filter((place) => !hidden.includes(place.name));
  const removed = all.length - travellers.length;
  return (
    <section className="page mt-24">
      <SectionTitle eyebrow="Live from the web · refreshed daily" aside={<Link to="/explore" className="btn btn-ghost">Explore all <ArrowRight className="h-4 w-4" /></Link>}>
        Trending in India <span className="accent">right now</span>
      </SectionTitle>
      <DestinationBento places={data?.web ?? []} loading={isLoading} />
      {!isLoading && !data?.web.length && <p className="glass p-5 text-sm text-mist">Trending places are refreshing. Search any place above to explore it.</p>}
      {all.length > 0 && (
        <div className="mt-16">
          <SectionTitle
            eyebrow="This month on Feel It"
            aside={removed > 0 && <button onClick={restore} className="btn btn-ghost !py-2 text-xs">Show {removed} removed</button>}
          >
            Where travellers are heading
          </SectionTitle>
          {travellers.length > 0 ? (
            <div className="scroll-row">
              {travellers.map((place) => <DestinationCard key={place.name} place={place} onRemove={() => hide(place.name)} className="h-80 w-60 shrink-0 snap-start sm:w-64" />)}
            </div>
          ) : (
            <p className="glass p-5 text-sm text-mist">You've removed these places. They'll come back if you tap "Show removed".</p>
          )}
        </div>
      )}
    </section>
  );
}

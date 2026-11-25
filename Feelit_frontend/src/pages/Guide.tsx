import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BedDouble, CalendarHeart, ExternalLink, Lightbulb, MapPin, MessageCircleHeart, ShoppingBag, TrainFront, Utensils } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { Picture, SectionTitle, SpotCard } from "@/components/cards";
import { Notice } from "@/components/Shell";
import { useWeather, WeatherNow } from "@/components/Weather";
import { useConversation } from "@/context/conversation";
import { api } from "@/lib/api";
import { cx, hotelsLink, inr, mapsLink, STYLES } from "@/lib/format";
import type { Style } from "@/lib/types";

/** Live guide to one destination: what's trending, where to eat, shop and stay. */
export default function Guide() {
  const { place = "" } = useParams();
  const navigate = useNavigate();
  const { send } = useConversation();
  const { data: guide, isLoading, error } = useQuery({
    queryKey: ["guide", place.toLowerCase()],
    queryFn: () => api.guide(place),
    staleTime: 6 * 60 * 60_000,
    retry: false,
  });
  const { data: weather } = useWeather(guide?.place);
  const [tier, setTier] = useState<Style>("comfort");

  if (isLoading) {
    return (
      <div className="page space-y-5 py-6">
        <div className="skeleton h-80" />
        <p className="text-center font-mono text-xs text-mist">Reading the live web for {place.split(",")[0]} — a new place takes about 15 seconds.</p>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <div key={i} className="skeleton h-60" />)}</div>
      </div>
    );
  }
  if (error || !guide) return <Notice title="We couldn't open that place">{error?.message}</Notice>;

  const near = guide.place.label;
  const stays = guide.stays[tier] ?? [];
  const planHere = () => {
    send(`Plan a trip to ${near}`);
    navigate("/plan");
  };

  return (
    <>
      <header className="relative isolate -mt-4 flex h-[calc(100svh-4rem)] min-h-[32rem] items-end overflow-hidden lg:-mt-8">
        <Picture src={guide.cover.url} alt={guide.place.name} className="absolute inset-0 -z-10 h-full w-full animate-kenburns" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-night via-night/40 to-night/10" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-night/70 to-transparent" />
        <div className="page pb-12">
          <p className="eyebrow">{guide.place.state}</p>
          <h1 className="mt-3 text-6xl leading-[0.9] sm:text-8xl">{guide.place.name}</h1>
          <p className="mt-4 max-w-2xl font-display text-xl italic text-snow/85 sm:text-2xl">{guide.tagline}</p>
          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
            {weather && <WeatherNow weather={weather} />}
            <span className="inline-flex items-center gap-1.5"><CalendarHeart className="h-4 w-4 text-rani" />Ideal for {guide.ideal_days} days</span>
            <button className="btn btn-primary" onClick={planHere}><MessageCircleHeart className="h-4 w-4" />Plan a trip here</button>
          </div>
          {guide.cover.credit && <a href={guide.cover.link} target="_blank" rel="noreferrer" className="tap mt-6 inline-block font-mono text-[10px] text-snow/50 hover:text-snow">Photo: {guide.cover.credit}</a>}
        </div>
      </header>

      <section className="page mt-14 grid gap-10 lg:grid-cols-[1.5fr_1fr]">
        <p className="font-display text-2xl leading-relaxed text-snow/90 first-letter:float-left first-letter:mr-3 first-letter:mt-1 first-letter:text-[4.5rem] first-letter:leading-[0.8] first-letter:text-saffron sm:text-[1.75rem]">{guide.about}</p>
        <dl className="self-start border-t border-white/10">
          <div className="border-b border-white/10 py-4"><dt className="label">Best time to visit</dt><dd className="text-sm">{guide.best_time}</dd></div>
          <div className="border-b border-white/10 py-4"><dt className="label">Ideal stay</dt><dd className="text-sm">{guide.ideal_days} days</dd></div>
          <div className="border-b border-white/10 py-4"><dt className="label">Getting there</dt><dd className="text-sm capitalize">{guide.getting_there.map((w) => w.mode).join(" · ") || "—"}</dd></div>
        </dl>
      </section>

      <section className="page mt-14">
        <SectionTitle eyebrow="From travel creators and the live web">Trending in {guide.place.name}</SectionTitle>
        <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
          {guide.trending.map((spot, i) => <SpotCard key={i} spot={spot} near={near} />)}
        </div>
      </section>

      <section className="page mt-20 grid gap-x-12 gap-y-14 lg:grid-cols-2">
        <Panel icon={Utensils} title="Where to eat">
          {guide.food.map((spot, i) => (
            <Row key={i} name={spot.name} href={mapsLink(spot.name, near)} detail={spot.known_for} sub={spot.area} badge={spot.cost_for_two_inr ? `${inr(spot.cost_for_two_inr)} for two` : undefined} />
          ))}
        </Panel>
        <div className="space-y-14">
          <Panel icon={ShoppingBag} title="What to buy">
            {guide.shopping.map((shop, i) => <Row key={i} name={shop.name} href={mapsLink(shop.name, near)} detail={shop.buy} sub={shop.area} />)}
          </Panel>
          <Panel
            icon={BedDouble}
            title="Where to stay"
            aside={
              <div className="flex rounded-full border border-white/10 p-0.5">
                {STYLES.map(({ value, label }) => (
                  <button key={value} onClick={() => setTier(value)} className={cx("rounded-full px-4 py-2 text-xs font-bold transition", tier === value ? "bg-snow text-night" : "text-mist hover:text-snow")}>{label}</button>
                ))}
              </div>
            }
          >
            {stays.map((stay, i) => <Row key={i} name={stay.name} href={hotelsLink(stay.name, near)} sub={stay.area} badge={stay.price_per_night_inr ? `~${inr(stay.price_per_night_inr)} / night` : undefined} />)}
            {!stays.length && <p className="py-3 text-sm text-mist">No {tier} stays in today's sources. Try another tier.</p>}
          </Panel>
        </div>
        <Panel icon={TrainFront} title="Getting there">
          {guide.getting_there.map((way, i) => <p key={i} className="py-2 text-sm"><span className="chip mr-2 capitalize">{way.mode}</span>{way.detail}</p>)}
        </Panel>
        <Panel icon={Lightbulb} title="Good to know">
          <ul className="space-y-2 py-1 text-sm">{guide.tips.map((tip, i) => <li key={i} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-saffron" />{tip}</li>)}</ul>
        </Panel>
      </section>
    </>
  );
}

function Panel({ icon: Icon, title, aside, children }: { icon: typeof Utensils; title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="border-t border-white/15 pt-5">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-3xl"><Icon className="h-5 w-5 text-saffron" />{title}</h2>
        {aside}
      </div>
      <div className="divide-y divide-white/[0.07]">{children}</div>
    </div>
  );
}

function Row({ name, href, detail, sub, badge }: { name: string; href: string; detail?: string; sub?: string; badge?: string }) {
  return (
    <div className="flex items-start justify-between gap-3 py-3">
      <div className="min-w-0">
        <a href={href} target="_blank" rel="noreferrer" className="tap inline-flex items-center gap-1 font-semibold hover:text-saffron">{name}<ExternalLink className="h-3 w-3 opacity-50" /></a>
        {detail && <p className="text-sm text-mist">{detail}</p>}
        {sub && <p className="mt-0.5 flex items-center gap-1 text-xs text-mist/70"><MapPin className="h-3 w-3" />{sub}</p>}
      </div>
      {badge && <span className="chip shrink-0">{badge}</span>}
    </div>
  );
}

import { useState, type ReactNode } from "react";
import { ChevronRight, Clock, MapPin, Mountain, Navigation, Ticket, X } from "lucide-react";
import { Link } from "react-router-dom";
import { cx, inr, mapsLink } from "@/lib/format";
import type { GuideSpot, TrendingPlace } from "@/lib/types";

/** A lazy-loaded photo that falls back to a soft gradient tile when there is none (or it fails to load). */
export function Picture({ src, alt, className }: { src?: string | null; alt: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className={cx("flex items-center justify-center bg-gradient-to-br from-panel via-deep to-rani/20 text-white/20", className)} role="img" aria-label={alt}>
        <Mountain className="h-8 w-8" />
      </div>
    );
  }
  return <img src={src} alt={alt} loading="lazy" decoding="async" onError={() => setFailed(true)} className={cx("object-cover", className)} />;
}

export function SectionTitle({ eyebrow, children, aside }: { eyebrow: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2 className="mt-2 text-3xl sm:text-4xl">{children}</h2>
      </div>
      {aside}
    </div>
  );
}

export function Grid({ children, loading, count = 4, className }: { children?: ReactNode; loading?: boolean; count?: number; className?: string }) {
  return (
    <div className={cx("grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4", className)}>
      {loading ? Array.from({ length: count }, (_, i) => <div key={i} className="skeleton aspect-[3/4]" />) : children}
    </div>
  );
}

/** A destination card that opens the place's live guide. `feature` makes it the large tile of a bento grid. */
export function DestinationCard({ place, index, onRemove, feature, className }: { place: TrendingPlace; index?: number; onRemove?: () => void; feature?: boolean; className?: string }) {
  const card = (
    <Link
      to={`/explore/${encodeURIComponent(`${place.name}, ${place.state}`)}`}
      className={cx("group relative block h-full overflow-hidden rounded-[1.25rem] ring-1 ring-white/10 transition duration-300 hover:ring-saffron/50", !feature && "min-h-[15rem]")}
    >
      <Picture src={place.cover.url} alt={place.name} className="absolute inset-0 h-full w-full transition duration-700 group-hover:scale-110" />
      <div className="absolute inset-0 bg-gradient-to-t from-night via-night/25 to-transparent" />
      <span className="absolute left-3 top-3 rounded-full bg-night/60 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-snow backdrop-blur">
        {place.trips ? `${place.trips} ${place.trips === 1 ? "trip" : "trips"} planned` : index !== undefined ? `Trending #${index + 1}` : place.best_for}
      </span>
      <div className={cx("absolute inset-x-0 bottom-0", feature ? "p-6 sm:p-8" : "p-4")}>
        <p className="font-mono text-[10px] uppercase tracking-widest text-saffron">{place.state}</p>
        <h3 className={cx("mt-1 leading-tight", feature ? "text-4xl sm:text-5xl" : "text-2xl")}>{place.name}</h3>
        {place.why && <p className={cx("mt-1 text-snow/75", feature ? "max-w-md text-sm" : "line-clamp-2 text-xs")}>{place.why}</p>}
        {feature && place.best_for && <p className="mt-3 inline-block rounded-full border border-white/20 px-3 py-1 text-xs font-semibold">Best for {place.best_for}</p>}
      </div>
    </Link>
  );
  if (!onRemove) return <div className={className}>{card}</div>;
  return (
    <div className={cx("group/card relative", className)}>
      {card}
      <button
        onClick={onRemove}
        aria-label={`Remove ${place.name}`}
        title="Remove"
        className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-night/70 text-snow/80 ring-1 ring-white/15 backdrop-blur transition hover:bg-coral hover:text-night sm:opacity-0 sm:group-hover/card:opacity-100 sm:focus-visible:opacity-100"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

const WIDEN = ["", "lg:col-span-2", "lg:col-span-3", "lg:col-span-4"];

/** Destinations as a bento mosaic: the first one large, the last one widened to close the final row. */
export function DestinationBento({ places, loading }: { places: TrendingPlace[]; loading?: boolean }) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 lg:grid-rows-[15rem_15rem]">
        <div className="skeleton col-span-2 min-h-[20rem] lg:row-span-2" />
        {Array.from({ length: 4 }, (_, i) => <div key={i} className="skeleton min-h-[15rem]" />)}
      </div>
    );
  }
  const spare = (4 + places.length - 1) % 4;
  const card = (place: TrendingPlace, index: number, className?: string) => (
    <DestinationCard
      key={place.name}
      place={place}
      index={index}
      feature={index === 0}
      className={cx("animate-rise", className, index > 0 && index === places.length - 1 && spare > 0 && WIDEN[4 - spare])}
    />
  );
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:auto-rows-[15rem] lg:grid-cols-4">
      {places.slice(0, 3).map((place, index) => card(place, index, index === 0 ? "col-span-2 min-h-[22rem] lg:row-span-2 lg:min-h-0" : undefined))}
      {places.length > 3 && (
        // Phones and tablets: a sideways row (two cards in view, swipe for more). Laptops: just more bento tiles.
        <div className="col-span-2 -mx-4 sm:-mx-6 lg:contents">
          <p className="mb-2 flex items-center justify-end gap-1 px-4 sm:px-6 font-mono text-[10px] uppercase tracking-widest text-mist lg:hidden">Swipe for more <ChevronRight className="h-3 w-3" /></p>
          <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:gap-4 sm:px-6 lg:contents [&::-webkit-scrollbar]:hidden">
            {places.slice(3).map((place, i) => card(place, i + 3, "h-60 w-[calc(50%-0.4rem)] shrink-0 snap-start sm:w-[calc(33%-0.5rem)] lg:h-auto lg:w-auto"))}
          </div>
        </div>
      )}
    </div>
  );
}

/** One real place to visit, with a photo, why it's worth it, and a Maps link. */
export function SpotCard({ spot, near }: { spot: GuideSpot; near: string }) {
  return (
    <article className="glass flex h-full flex-col overflow-hidden transition hover:border-white/20">
      <Picture src={spot.image} alt={spot.name} className="aspect-[4/3] w-full" />
      <div className="flex flex-1 flex-col p-3.5">
        <h3 className="font-sans text-sm font-bold leading-snug">{spot.name}</h3>
        <p className="mt-1 line-clamp-3 flex-1 text-xs text-mist">{spot.why}</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {spot.km != null && <span className="chip"><Navigation className="h-3 w-3" />{spot.km} km</span>}
          {spot.hours_needed ? <span className="chip"><Clock className="h-3 w-3" />{spot.hours_needed} h</span> : null}
          {spot.entry_fee_inr != null && <span className="chip"><Ticket className="h-3 w-3" />{spot.entry_fee_inr ? inr(spot.entry_fee_inr) : "Free"}</span>}
          <a href={mapsLink(spot.name, near)} target="_blank" rel="noreferrer" className="tap chip text-sky hover:bg-white/10"><MapPin className="h-3 w-3" />Map</a>
        </div>
      </div>
    </article>
  );
}

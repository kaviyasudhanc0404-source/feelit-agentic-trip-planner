import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { cx } from "@/lib/format";
import type { TrendingPlace } from "@/lib/types";
import { Picture } from "./cards";

export const HOUR = 60 * 60_000;

/** Live trending destinations (refreshed daily on the server). */
export const useTrending = () => useQuery({ queryKey: ["trending"], queryFn: api.trending, staleTime: HOUR });

/** One destination as a postcard: photo, name and state on white card stock. */
function Postcard({ place, tilt = 0, className }: { place: TrendingPlace | null; tilt?: number; className?: string }) {
  const card = (
    <div className={cx("rounded-2xl bg-snow p-2 pb-3 shadow-lift transition duration-300 hover:!rotate-0 hover:scale-[1.03]", className)} style={{ transform: `rotate(${tilt}deg)` }}>
      {place ? <Picture src={place.cover.url} alt={place.name} className="aspect-[4/3] w-full rounded-xl" /> : <div className="aspect-[4/3] rounded-xl bg-gradient-to-br from-saffron/40 to-rani/40" />}
      <p className="mt-2 px-1 font-display text-lg leading-tight text-night">{place?.name ?? "Somewhere new"}</p>
      <p className="px-1 font-mono text-[10px] uppercase tracking-wider text-night/50">{place?.state ?? "India"}</p>
    </div>
  );
  return place ? <Link to={`/explore/${encodeURIComponent(`${place.name}, ${place.state}`)}`} className="block">{card}</Link> : card;
}

/** Postcards drifting past in columns (vertical) or a single row (horizontal). Pauses on hover. */
export function PostcardStream({ direction = "vertical", columns = 2, className }: { direction?: "vertical" | "horizontal"; columns?: number; className?: string }) {
  const { data } = useTrending();
  const places = data?.web ?? [];

  if (direction === "horizontal") {
    const row = places.length ? [...places, ...places] : Array.from({ length: 6 }, () => null);
    return (
      <div className={cx("overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]", className)}>
        <div className={cx("flex w-max gap-4 py-4 hover:[animation-play-state:paused]", places.length > 0 && "animate-scroll-x")}>
          {row.map((place, i) => <Postcard key={i} place={place} tilt={i % 2 ? 2 : -2} className="w-44" />)}
        </div>
      </div>
    );
  }

  const lanes = Array.from({ length: columns }, (_, c) => places.filter((_, i) => i % columns === c));
  return (
    <div className={cx("grid gap-4 overflow-hidden [mask-image:linear-gradient(to_bottom,transparent,black_12%,black_88%,transparent)]", className)} style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
      {lanes.map((lane, c) => (
        <div key={c} className={cx(c % 2 === 1 && "pt-24")}>
          <div className={cx("space-y-4 hover:[animation-play-state:paused]", lane.length > 0 && "animate-scroll-y", c % 2 === 1 && "[animation-direction:reverse]")}>
            {(lane.length ? [...lane, ...lane] : Array.from({ length: 4 }, () => null)).map((place, i) => <Postcard key={i} place={place} tilt={(i + c) % 2 ? 2 : -2} />)}
          </div>
        </div>
      ))}
    </div>
  );
}

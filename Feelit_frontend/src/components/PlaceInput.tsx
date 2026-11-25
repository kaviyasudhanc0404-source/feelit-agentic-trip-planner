import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { LocateFixed, MapPin, Search } from "lucide-react";
import { api } from "@/lib/api";
import { cx } from "@/lib/format";
import type { Place } from "@/lib/types";

function useDebounced<T>(value: T, delay = 300) {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return settled;
}

/** Type-ahead search over real towns and cities in India. `onLocate` adds a "use my location" button inside the box. */
export function PlaceInput({ placeholder, initial = "", large = false, onPick, onLocate }: { placeholder: string; initial?: string; large?: boolean; onPick: (place: Place) => void; onLocate?: () => void }) {
  const [text, setText] = useState(initial);
  const [open, setOpen] = useState(false);
  const term = useDebounced(text.trim());
  const { data: matches = [] } = useQuery({
    queryKey: ["autocomplete", term],
    queryFn: () => api.autocomplete(term),
    enabled: open && term.length >= 2,
    staleTime: Infinity,
  });

  const pick = (place: Place) => {
    setText(place.label);
    setOpen(false);
    onPick(place);
  };

  return (
    <div className="relative" onBlur={(event) => !event.currentTarget.contains(event.relatedTarget) && setOpen(false)}>
      <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-mist" />
      <input
        value={text}
        onChange={(event) => { setText(event.target.value); setOpen(true); }}
        onKeyDown={(event) => { if (event.key === "Enter" && matches[0]) { event.preventDefault(); pick(matches[0]); } }}
        placeholder={placeholder}
        className={cx("input pl-11", large && "!py-3.5 !text-base", onLocate && "pr-14")}
        role="combobox"
        aria-expanded={open && matches.length > 0}
        aria-autocomplete="list"
        autoComplete="off"
      />
      {onLocate && (
        <button
          type="button"
          onClick={onLocate}
          aria-label="Use my location"
          title="Use my location"
          className="absolute right-1.5 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-peacock/15 text-peacock transition hover:bg-peacock/25 active:scale-95"
        >
          <LocateFixed className="h-5 w-5" />
        </button>
      )}
      {open && matches.length > 0 && (
        <ul className="glass-strong absolute z-20 mt-2 w-full overflow-hidden !rounded-2xl" role="listbox">
          {matches.map((place) => (
            <li key={`${place.lat},${place.lon}`}>
              <button type="button" onClick={() => pick(place)} className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm hover:bg-white/10">
                <MapPin className="h-4 w-4 shrink-0 text-saffron" />
                {place.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

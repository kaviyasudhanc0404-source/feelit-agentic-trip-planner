import { useState } from "react";
import { ArrowDown, ArrowUp, CalendarPlus, Plus, Save, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { CATEGORY, cx, inr, STYLES } from "@/lib/format";
import { useSaveTrip } from "@/lib/trips";
import type { Budget, Category, Style, Trip, TripUpdate } from "@/lib/types";

type EditStop = NonNullable<TripUpdate["days"]>[number]["items"][number];
type EditDay = { theme: string; items: EditStop[] };
const BUDGET_KEYS: (keyof Omit<Budget, "total">)[] = ["stay", "food", "transport", "activities", "misc"];
const MAX_DAYS = 10;

const blankStop = (time: string): EditStop => ({ id: "", time, name: "", category: "sight", description: "", duration_min: 60, cost_inr: 0, tip: null });

function nextTime(items: EditStop[]) {
  const last = items[items.length - 1]?.time ?? "08:00";
  const [h, m] = last.split(":").map(Number);
  return `${String(Math.min(h + 1, 22)).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Edit everything about a trip by hand: details, dates, budget and every stop of every day. */
export function TripEditor({ trip, onClose }: { trip: Trip; onClose: () => void }) {
  const save = useSaveTrip(trip.id, onClose);
  const [details, setDetails] = useState({
    title: trip.title,
    start_date: trip.start_date,
    travellers: trip.travellers,
    style: trip.style,
    budget_limit: trip.budget_limit,
  });
  const [budget, setBudget] = useState(() => Object.fromEntries(BUDGET_KEYS.map((k) => [k, trip.budget[k]])) as Omit<Budget, "total">);
  const [days, setDays] = useState<EditDay[]>(() =>
    trip.days.map((d) => ({ theme: d.theme, items: d.items.map(({ id, time, name, category, description, duration_min, cost_inr, tip }) => ({ id, time, name, category, description, duration_min, cost_inr, tip })) })),
  );

  const changeDay = (index: number, change: (day: EditDay) => EditDay) => setDays((all) => all.map((d, i) => (i === index ? change(d) : d)));
  const changeStop = (day: number, stop: number, patch: Partial<EditStop>) =>
    changeDay(day, (d) => ({ ...d, items: d.items.map((s, i) => (i === stop ? { ...s, ...patch } : s)) }));

  /** Swap two neighbouring stops, and their times, so the order on screen is the order of the day. */
  const swap = (day: number, a: number, b: number) =>
    changeDay(day, (d) => {
      if (b < 0 || b >= d.items.length) return d;
      const items = [...d.items];
      [items[a], items[b]] = [{ ...items[b], time: items[a].time }, { ...items[a], time: items[b].time }];
      return { ...d, items };
    });

  const moveToDay = (from: number, stop: number, to: number) =>
    setDays((all) => {
      const moving = all[from].items[stop];
      return all.map((d, i) => {
        if (i === from) return { ...d, items: d.items.filter((_, j) => j !== stop) };
        if (i === to) return { ...d, items: [...d.items, { ...moving, time: nextTime(d.items) }] };
        return d;
      });
    });

  const itemsTotal = days.reduce((sum, d) => sum + d.items.reduce((s, i) => s + (i.cost_inr || 0), 0), 0);
  const budgetTotal = BUDGET_KEYS.reduce((sum, k) => sum + (budget[k] || 0), 0);

  const submit = () => {
    const kept = days.filter((d) => d.items.length);
    if (!details.title.trim()) return toast.error("Give your trip a name.");
    if (!kept.length) return toast.error("Keep at least one stop in your trip.");
    if (kept.some((d) => d.items.some((s) => !s.name.trim()))) return toast.error("Every stop needs a name.");
    save.mutate({
      ...details,
      title: details.title.trim(),
      budget,
      days: kept.map((d) => ({ ...d, items: d.items.map((s) => ({ ...s, name: s.name.trim(), id: s.id || undefined })) as EditStop[] })),
    });
  };

  return (
    <div className="space-y-6">
      <section className="glass grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-5">
        <label className="sm:col-span-2"><span className="label">Trip name</span><input className="input" maxLength={80} value={details.title} onChange={(e) => setDetails({ ...details, title: e.target.value })} /></label>
        <label><span className="label">Start date</span><input type="date" className="input" value={details.start_date} onChange={(e) => e.target.value && setDetails({ ...details, start_date: e.target.value })} /></label>
        <label><span className="label">Travellers</span><input type="number" min={1} max={20} className="input" value={details.travellers} onChange={(e) => setDetails({ ...details, travellers: Math.min(20, Math.max(1, +e.target.value)) })} /></label>
        <label><span className="label">Style</span>
          <select className="input" value={details.style} onChange={(e) => setDetails({ ...details, style: e.target.value as Style })}>
            {STYLES.map((s) => <option key={s.value} value={s.value} className="bg-deep">{s.label}</option>)}
          </select>
        </label>
      </section>

      <section className="glass p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow">Budget</p>
            <p className="mt-1 text-sm text-mist">Estimated total <b className="text-snow">{inr(budgetTotal)}</b> · stops add up to {inr(itemsTotal)}</p>
          </div>
          <label className="w-44"><span className="label">Your limit (₹)</span><input type="number" min={0} step={1000} className="input" placeholder="None" value={details.budget_limit ?? ""} onChange={(e) => setDetails({ ...details, budget_limit: e.target.value ? +e.target.value : null })} /></label>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {BUDGET_KEYS.map((key) => (
            <label key={key}><span className="label">{key === "misc" ? "Shopping & extras" : key}</span>
              <input type="number" min={0} step={100} className="input" value={budget[key]} onChange={(e) => setBudget({ ...budget, [key]: Math.max(0, +e.target.value) })} />
            </label>
          ))}
        </div>
      </section>

      {days.map((day, dayIndex) => (
        <section key={dayIndex} className="glass p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-gradient-to-r from-saffron to-coral px-3 py-1 font-mono text-xs font-bold text-night">Day {dayIndex + 1}</span>
            <input className="input flex-1 !py-2 font-display text-lg" placeholder="Theme of the day" maxLength={80} value={day.theme} onChange={(e) => changeDay(dayIndex, (d) => ({ ...d, theme: e.target.value }))} />
            {days.length > 1 && (
              <button className="btn-icon hover:text-coral" aria-label={`Remove day ${dayIndex + 1}`} onClick={() => setDays(days.filter((_, i) => i !== dayIndex))}><Trash2 className="h-4 w-4" /></button>
            )}
          </div>

          <ol className="mt-4 space-y-3">
            {day.items.map((stop, stopIndex) => (
              <li key={stop.id || `new-${stopIndex}`} className="rounded-2xl border border-white/10 bg-night/40 p-3">
                <div className="grid grid-cols-[7.5rem_1fr] gap-2 sm:grid-cols-[7.5rem_7rem_1fr_6.5rem_6rem_auto]">
                  <input type="time" className="input !px-2 !py-2" value={stop.time} onChange={(e) => changeStop(dayIndex, stopIndex, { time: e.target.value })} aria-label="Time" />
                  <select className="input !py-2" value={stop.category} onChange={(e) => changeStop(dayIndex, stopIndex, { category: e.target.value as Category })} aria-label="Type">
                    {Object.entries(CATEGORY).map(([value, { label }]) => <option key={value} value={value} className="bg-deep">{label}</option>)}
                  </select>
                  <input className="input col-span-2 !py-2 sm:col-span-1" placeholder="Place name" maxLength={120} value={stop.name} onChange={(e) => changeStop(dayIndex, stopIndex, { name: e.target.value })} aria-label="Place name" />
                  <label className="relative"><span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-mist">₹</span>
                    <input type="number" min={0} step={50} className="input !py-2 pl-7" value={stop.cost_inr} onChange={(e) => changeStop(dayIndex, stopIndex, { cost_inr: Math.max(0, +e.target.value) })} aria-label="Cost" />
                  </label>
                  <label className="relative">
                    <input type="number" min={0} step={15} className="input !py-2 pr-10" value={stop.duration_min} onChange={(e) => changeStop(dayIndex, stopIndex, { duration_min: Math.max(0, +e.target.value) })} aria-label="Minutes" />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-mist">min</span>
                  </label>
                  <div className="col-span-2 flex items-center justify-end gap-1 sm:col-span-1">
                    <button className="btn-icon !h-9 !w-9" aria-label="Move up" disabled={stopIndex === 0} onClick={() => swap(dayIndex, stopIndex, stopIndex - 1)}><ArrowUp className="h-4 w-4" /></button>
                    <button className="btn-icon !h-9 !w-9" aria-label="Move down" disabled={stopIndex === day.items.length - 1} onClick={() => swap(dayIndex, stopIndex, stopIndex + 1)}><ArrowDown className="h-4 w-4" /></button>
                    {days.length > 1 && (
                      <select className="input !w-auto !py-2 text-xs" value="" aria-label="Move to another day" onChange={(e) => moveToDay(dayIndex, stopIndex, +e.target.value)}>
                        <option value="" className="bg-deep">Move</option>
                        {days.map((_, i) => i !== dayIndex && <option key={i} value={i} className="bg-deep">To day {i + 1}</option>)}
                      </select>
                    )}
                    <button className="btn-icon !h-9 !w-9 hover:text-coral" aria-label="Remove stop" onClick={() => changeDay(dayIndex, (d) => ({ ...d, items: d.items.filter((_, i) => i !== stopIndex) }))}><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
                <input className="input mt-2 !py-2 text-xs" placeholder="Notes or description" maxLength={400} value={stop.description} onChange={(e) => changeStop(dayIndex, stopIndex, { description: e.target.value })} aria-label="Description" />
              </li>
            ))}
          </ol>
          {!day.items.length && <p className="mt-3 text-sm text-coral">This day is empty and will be removed when you save. Add a stop to keep it.</p>}
          <button className="btn btn-ghost mt-3 !py-2" onClick={() => changeDay(dayIndex, (d) => ({ ...d, items: [...d.items, blankStop(nextTime(d.items))] }))}><Plus className="h-4 w-4" />Add a stop</button>
        </section>
      ))}

      {days.length < MAX_DAYS && (
        <button className="btn btn-ghost w-full !py-3" onClick={() => setDays([...days, { theme: "Free day", items: [{ ...blankStop("10:00"), name: "Free time to explore", category: "activity" }] }])}>
          <CalendarPlus className="h-4 w-4" />Add a day
        </button>
      )}

      <div className="no-print sticky bottom-[calc(6rem+env(safe-area-inset-bottom))] z-20 md:bottom-6 flex items-center justify-between gap-3 rounded-full border border-white/10 bg-deep/90 p-2 pl-5 shadow-lift backdrop-blur-xl">
        <p className="hidden text-sm text-mist sm:block">New or renamed places get map pins and photos when you save.</p>
        <span className={cx("flex gap-2", "ml-auto")}>
          <button className="btn btn-ghost" onClick={onClose} disabled={save.isPending}><X className="h-4 w-4" />Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={save.isPending}><Save className="h-4 w-4" />{save.isPending ? "Saving…" : "Save changes"}</button>
        </span>
      </div>
    </div>
  );
}

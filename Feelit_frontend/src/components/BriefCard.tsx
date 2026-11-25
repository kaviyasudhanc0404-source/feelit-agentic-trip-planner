import { useState } from "react";
import { ArrowRight, CalendarDays, Pencil, Plane, Users, Utensils, Wallet } from "lucide-react";
import { useTripBuilder } from "@/context/builder";
import { cx, FOODS, GROUPS, inr, INTERESTS, labelOf, PACES, shortDate, STYLES, todayIso } from "@/lib/format";
import type { Brief } from "@/lib/types";

/** The trip brief the agent prepared, drawn as a boarding pass. Every field can be changed before building. */
export function BriefCard({ brief: initial, active }: { brief: Brief; active: boolean }) {
  const build = useTripBuilder();
  const [brief, setBrief] = useState(initial);
  const [editing, setEditing] = useState(false);
  const set = <K extends keyof Brief>(key: K, value: Brief[K]) => setBrief((b) => ({ ...b, [key]: value }));
  const toggleInterest = (interest: string) =>
    set("interests", brief.interests.some((i) => i.toLowerCase() === interest.toLowerCase())
      ? brief.interests.filter((i) => i.toLowerCase() !== interest.toLowerCase())
      : [...brief.interests, interest]);

  const where = brief.destination ?? "Near you";
  return (
    <div className="glass-strong overflow-hidden">
      <div className="relative bg-gradient-to-r from-saffron/20 via-coral/15 to-rani/20 p-5">
        <p className="eyebrow !text-snow/70">Trip brief</p>
        <div className="mt-3 flex items-center gap-3">
          <div className="min-w-0">
            <p className="font-mono text-[11px] uppercase text-mist">From</p>
            <p className="truncate font-display text-xl">{brief.origin?.split(",")[0] ?? "—"}</p>
          </div>
          <div className="flex flex-1 items-center gap-1 text-saffron">
            <span className="h-px flex-1 border-t border-dashed border-saffron/50" />
            <Plane className="h-5 w-5" />
            <span className="h-px flex-1 border-t border-dashed border-saffron/50" />
          </div>
          <div className="min-w-0 text-right">
            <p className="font-mono text-[11px] uppercase text-mist">To</p>
            <p className="truncate font-display text-xl">{where.split(",")[0]}</p>
          </div>
        </div>
      </div>

      {editing ? (
        <div className="grid gap-3 p-5 sm:grid-cols-2">
          <Field label="Destination"><input className="input" value={brief.destination ?? ""} onChange={(e) => set("destination", e.target.value || null)} /></Field>
          <Field label="Starting from"><input className="input" value={brief.origin ?? ""} onChange={(e) => set("origin", e.target.value || null)} /></Field>
          <Field label="Start date"><input type="date" className="input" min={todayIso()} value={brief.start_date ?? ""} onChange={(e) => set("start_date", e.target.value)} /></Field>
          <Field label="Days"><input type="number" className="input" min={1} max={10} value={brief.days} onChange={(e) => set("days", Math.min(10, Math.max(1, +e.target.value)))} /></Field>
          <Field label="Travellers"><input type="number" className="input" min={1} max={20} value={brief.travellers} onChange={(e) => set("travellers", Math.min(20, Math.max(1, +e.target.value)))} /></Field>
          <Field label="Total budget (₹)"><input type="number" className="input" min={0} step={1000} value={brief.budget_inr ?? ""} placeholder="No fixed budget" onChange={(e) => set("budget_inr", e.target.value ? +e.target.value : null)} /></Field>
          <Field label="Group"><Select value={brief.group} options={GROUPS} onChange={(v) => set("group", v)} /></Field>
          <Field label="Style"><Select value={brief.style} options={STYLES} onChange={(v) => set("style", v)} /></Field>
          <Field label="Food"><Select value={brief.food_pref} options={FOODS} onChange={(v) => set("food_pref", v)} /></Field>
          <Field label="Pace"><Select value={brief.pace} options={PACES} onChange={(v) => set("pace", v)} /></Field>
          <Field label="Interests" wide>
            <div className="flex flex-wrap gap-2">
              {INTERESTS.map((interest) => {
                const on = brief.interests.some((i) => i.toLowerCase() === interest.toLowerCase());
                return <button key={interest} type="button" onClick={() => toggleInterest(interest)} className={cx("chip", on && "chip-on")}>{interest}</button>;
              })}
            </div>
          </Field>
          <Field label="Anything else" wide><textarea className="input min-h-[70px]" maxLength={300} value={brief.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-4 p-5 sm:grid-cols-4">
          <Fact icon={CalendarDays} label="When" value={brief.start_date ? shortDate(brief.start_date) : "Next weekend"} />
          <Fact icon={CalendarDays} label="Length" value={brief.days === 1 ? "Day trip" : `${brief.days} days`} />
          <Fact icon={Users} label="Who" value={`${brief.travellers} · ${labelOf(GROUPS, brief.group)}`} />
          <Fact icon={Wallet} label="Budget" value={brief.budget_inr ? inr(brief.budget_inr) : "Flexible"} />
          <Fact icon={Utensils} label="Food" value={labelOf(FOODS, brief.food_pref)} />
          <Fact label="Style" value={labelOf(STYLES, brief.style)} />
          <Fact label="Pace" value={labelOf(PACES, brief.pace)} />
          <Fact label="Into" value={brief.interests.join(", ") || "A bit of everything"} />
          {brief.notes && <p className="col-span-full text-sm text-mist">“{brief.notes}”</p>}
        </div>
      )}

      {active && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-dashed border-white/15 p-4">
          <button className="btn btn-ghost" onClick={() => setEditing(!editing)}><Pencil className="h-4 w-4" />{editing ? "Done editing" : "Edit details"}</button>
          <button className="btn btn-primary" disabled={!brief.destination && brief.lat == null} onClick={() => build(brief)}>
            Build my trip <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

function Field({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return <label className={cx("block", wide && "sm:col-span-2")}><span className="label">{label}</span>{children}</label>;
}

function Select<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (value: T) => void }) {
  return (
    <select className="input" value={value} onChange={(e) => onChange(e.target.value as T)}>
      {options.map((o) => <option key={o.value} value={o.value} className="bg-deep">{o.label}</option>)}
    </select>
  );
}

function Fact({ icon: Icon, label, value }: { icon?: typeof Users; label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-mist">{Icon && <Icon className="h-3 w-3" />}{label}</p>
      <p className="mt-0.5 truncate text-sm font-semibold capitalize">{value}</p>
    </div>
  );
}

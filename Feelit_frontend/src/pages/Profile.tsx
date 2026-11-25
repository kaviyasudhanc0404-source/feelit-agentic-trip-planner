import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BellRing, LogOut, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { PasswordSection } from "@/components/PasswordSection";
import { PlaceInput } from "@/components/PlaceInput";
import { useAuth } from "@/context/auth";
import { api } from "@/lib/api";
import { Mark } from "@/components/Logo";
import { cx, daysBetween, FOODS, indianMobile, showPhone, STYLES } from "@/lib/format";

function Options<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (value: T) => void }) {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {options.map((option) => (
        <button key={option.value} type="button" onClick={() => onChange(option.value)} className={cx("chip px-4 py-2 text-sm transition", value === option.value ? "chip-on" : "hover:bg-white/10")}>
          {option.label}
        </button>
      ))}
    </div>
  );
}

/** Mobile number with a fixed +91 prefix; checked as you type and saved when you leave the box (or press Enter). */
function PhoneField({ current, onSave }: { current: string | null; onSave: (phone: string) => void }) {
  const [typed, setTyped] = useState(current?.replace(/^\+91/, "") ?? "");
  const normalised = indianMobile(typed);
  const commit = () => normalised !== null && normalised !== (current ?? "") && onSave(normalised);
  return (
    <label className="block border-t border-white/10 pt-5">
      <span className="label">Mobile number</span>
      <span className="relative block">
        <span className="pointer-events-none absolute left-4 top-1/2 flex -translate-y-1/2 items-center gap-2 text-sm font-semibold text-mist">
          <Smartphone className="h-4 w-4 text-saffron" />+91
        </span>
        <input
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          maxLength={14}
          placeholder="98765 43210"
          value={typed}
          onChange={(e) => setTyped(e.target.value.replace(/[^\d\s+-]/g, ""))}
          onBlur={commit}
          onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
          aria-invalid={normalised === null}
          className={cx("input pl-[4.75rem]", normalised === null && "!border-coral/60")}
        />
      </span>
      <span className={cx("mt-1.5 block text-xs", normalised === null ? "text-coral" : "text-mist")}>
        {normalised === null ? "Enter a valid 10-digit Indian mobile number." : "Used only for your trips. Leave it empty to remove it."}
      </span>
    </label>
  );
}

/** Preferences the agent uses as defaults, plus a few travel stats. */
export default function Profile() {
  const { user, saveProfile, signOut } = useAuth();
  const [name, setName] = useState(user!.name);
  const { data: trips = [] } = useQuery({ queryKey: ["trips"], queryFn: api.trips });
  const stats = [
    { label: "Trips planned", value: trips.length },
    { label: "Days of travel", value: trips.reduce((sum, t) => sum + daysBetween(t.start_date, t.end_date) + 1, 0) },
    { label: "Places", value: new Set(trips.map((t) => t.destination.label)).size },
  ];

  const save = (changes: Parameters<typeof saveProfile>[0]) =>
    saveProfile(changes).then(() => toast.success("Saved. The agent will use this from now on.")).catch((error: Error) => toast.error(error.message));

  return (
    <div className="page max-w-3xl py-2 sm:py-6">
      <section className="relative overflow-hidden rounded-[1.25rem] border border-gold/25 bg-gradient-to-br from-[#14213d] to-[#0b1224] p-6 sm:p-8">
        <Mark className="absolute -right-8 -top-8 h-40 w-40 opacity-10" />
        <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-gold/80">Republic of travel · Feel It passport</p>
        <div className="mt-6 flex items-center gap-5">
          <span className="flex h-24 w-20 items-center justify-center rounded-lg border border-gold/30 bg-saffron/90 font-display text-5xl text-night">{user!.name[0].toUpperCase()}</span>
          <div className="min-w-0 font-mono text-xs uppercase tracking-wider">
            <p className="text-gold/60">Name</p>
            <p className="truncate font-display text-3xl normal-case tracking-normal text-snow">{user!.name}</p>
            <p className="mt-2 text-gold/60">Home city</p>
            <p className="text-snow/90">{user!.home_city ?? "Not set"}</p>
            <p className="mt-2 text-gold/60">Mobile</p>
            <p className="text-snow/90">{user!.phone ? showPhone(user!.phone) : "Not set"}</p>
          </div>
        </div>
        <div className="mt-8 flex flex-wrap gap-3 sm:gap-4">
          {stats.map((s, i) => (
            <div key={s.label} className={cx("flex h-[5.25rem] w-[5.25rem] flex-col items-center justify-center rounded-full border-2 border-dashed text-center sm:h-24 sm:w-24", ["-rotate-6 border-saffron/60 text-saffron", "rotate-3 border-peacock/60 text-peacock", "-rotate-2 border-rani/60 text-rani"][i])}>
              <span className="font-display text-3xl leading-none">{s.value}</span>
              <span className="mt-1 px-2 font-mono text-[9px] font-bold uppercase leading-tight">{s.label}</span>
            </div>
          ))}
        </div>
        <p className="mt-6 truncate font-mono text-[11px] tracking-[0.2em] text-gold/40" aria-hidden>{`P<IND${user!.name.toUpperCase().replace(/[^A-Z]/g, "<")}`.padEnd(44, "<")}</p>
      </section>

      <p className="eyebrow mt-10">What the agent knows about you</p>
      <div className="mt-4 space-y-6">
        <label className="block border-t border-white/10 pt-5">
          <span className="label">Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} onBlur={() => name.trim().length >= 2 && name !== user!.name && save({ name: name.trim() })} maxLength={60} className="input" />
        </label>
        <PhoneField current={user!.phone} onSave={(phone) => save({ phone })} />
        <div className="border-t border-white/10 pt-5">
          <span className="label">Home city</span>
          <p className="mb-3 text-xs text-mist">Trips start from here unless you say otherwise.</p>
          <PlaceInput placeholder="Search your city" initial={user!.home_city ?? ""} onPick={(place) => save({ home_city: place.label })} />
        </div>
        <div className="border-t border-white/10 pt-5">
          <span className="label">Usual travel style</span>
          <Options value={user!.style} options={STYLES} onChange={(style) => save({ style })} />
        </div>
        <div className="border-t border-white/10 pt-5">
          <span className="label">Food preference</span>
          <Options value={user!.food_pref} options={FOODS} onChange={(food_pref) => save({ food_pref })} />
        </div>
        <label className="flex cursor-pointer items-center justify-between gap-4 border-t border-white/10 pt-5">
          <span>
            <span className="label">Trip reminders</span>
            <span className="flex items-center gap-2 text-sm text-mist"><BellRing className="h-4 w-4 text-saffron" />One email the evening before each trip, with your day 1 plan and the weather.</span>
          </span>
          <input
            type="checkbox"
            role="switch"
            checked={user!.trip_reminders}
            onChange={(e) => save({ trip_reminders: e.target.checked })}
            className="peer sr-only"
          />
          <span aria-hidden className="relative h-7 w-12 shrink-0 rounded-full bg-white/15 transition after:absolute after:left-1 after:top-1 after:h-5 after:w-5 after:rounded-full after:bg-snow after:transition peer-checked:bg-saffron peer-checked:after:translate-x-5 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-saffron" />
        </label>
        <PasswordSection />
        <button onClick={signOut} className="btn btn-ghost"><LogOut className="h-4 w-4" />Sign out</button>
      </div>
    </div>
  );
}

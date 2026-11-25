import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { Mark } from "@/components/Logo";
import { api } from "@/lib/api";
import type { Brief } from "@/lib/types";
import { useAuth } from "./auth";
import { readJSON, writeJSON, writeText } from "@/lib/storage";

const PENDING_KEY = "feelit_pending_brief";
const BuilderContext = createContext<((brief: Brief) => void) | null>(null);

/** Builds trips from confirmed briefs and shows the live build screen while the agent works. */
export function BuilderProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [build, setBuild] = useState<{ brief: Brief; steps: string[] } | null>(null);

  const run = useCallback(
    async (brief: Brief) => {
      setBuild({ brief, steps: [] });
      try {
        const tripId = await api.plan(brief, (step) => setBuild((now) => now && { ...now, steps: [...now.steps, step] }));
        queryClient.invalidateQueries({ queryKey: ["trips"] });
        queryClient.invalidateQueries({ queryKey: ["trending"] });
        toast.success("Your trip is ready. Edit anything you like.");
        navigate(`/trips/${tripId}`);
      } catch (error) {
        toast.error((error as Error).message);
      } finally {
        setBuild(null);
      }
    },
    [navigate, queryClient],
  );

  const start = useCallback(
    (brief: Brief) => {
      if (user) return void run(brief);
      // Keep the brief so the build starts by itself right after sign-in.
      writeJSON(PENDING_KEY, brief, "session");
      toast("Sign in to build and save your trip");
      navigate("/auth", { state: { from: "/plan" } });
    },
    [user, run, navigate],
  );

  useEffect(() => {
    const pending = user && readJSON<Brief | null>(PENDING_KEY, null, "session");
    if (pending) {
      writeText(PENDING_KEY, null, "session");
      run(pending);
    }
  }, [user, run]);

  return (
    <BuilderContext.Provider value={start}>
      {children}
      {build && <BuildScreen brief={build.brief} steps={build.steps} />}
    </BuilderContext.Provider>
  );
}

export function useTripBuilder() {
  const build = useContext(BuilderContext);
  if (!build) throw new Error("useTripBuilder must be used inside BuilderProvider");
  return build;
}

function BuildScreen({ brief, steps }: { brief: Brief; steps: string[] }) {
  const where = brief.destination?.split(",")[0] ?? "your trip";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-night/90 p-6 backdrop-blur-xl" role="status" aria-live="polite">
      <div className="w-full max-w-lg animate-rise">
        <div className="relative mb-10 h-28">
          <svg viewBox="0 0 400 110" className="absolute inset-0 h-full w-full" aria-hidden>
            <defs>
              <linearGradient id="route" x1="0" x2="1">
                <stop offset="0" stopColor="#FF9F45" />
                <stop offset="1" stopColor="#E8378E" />
              </linearGradient>
            </defs>
            <path d="M14 86 C 90 4, 160 110, 230 50 S 340 14, 386 40" fill="none" stroke="url(#route)" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="3 11" className="animate-trail" />
            <circle cx="14" cy="86" r="6" fill="#F5F1E8" />
            <circle cx="386" cy="40" r="8" fill="#FF5D73" />
            <circle cx="386" cy="40" r="16" fill="none" stroke="#FF5D73" strokeOpacity=".4" className="animate-ping origin-[386px_40px]" />
          </svg>
          <Mark className="absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 animate-float" />
        </div>
        <p className="eyebrow">Agent at work</p>
        <h2 className="mt-2 text-4xl sm:text-5xl">
          Crafting <span className="accent">{where}</span>
        </h2>
        <p className="mt-2 text-mist">
          {brief.days} {brief.days === 1 ? "day" : "days"} · {brief.travellers} {brief.travellers === 1 ? "traveller" : "travellers"} · {brief.style}
        </p>
        <ol className="mt-8 space-y-3 font-mono text-sm">
          {steps.map((step, index) => {
            const current = index === steps.length - 1;
            return (
              <li key={step} className={current ? "flex items-center gap-3 text-snow" : "flex items-center gap-3 text-mist"}>
                {current ? <span className="h-2 w-2 animate-pulse rounded-full bg-saffron" /> : <Check className="h-4 w-4 text-peacock" />}
                {step}
              </li>
            );
          })}
        </ol>
        <p className="mt-8 text-xs text-mist/70">Usually 10–40 seconds. Live web, weather and map data, so keep this tab open.</p>
      </div>
    </div>
  );
}

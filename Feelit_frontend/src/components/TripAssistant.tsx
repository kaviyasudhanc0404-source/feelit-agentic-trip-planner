import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { Trip } from "@/lib/types";
import { Composer } from "./Composer";
import { Mark } from "./Logo";
import { Thread } from "./Thread";

const STARTERS = ["Make it cheaper", "Add a rainy-day backup", "Find more local food spots", "What should I book in advance?"];

/** Talk to the agent about one trip. Changes it makes are saved and shown immediately. */
export function useTripAssistant(trip: Trip) {
  const queryClient = useQueryClient();
  const [live, setLive] = useState<{ text: string; steps: string[] } | null>(null);

  const send = useCallback(
    async (text: string) => {
      if (live || !text.trim()) return;
      const steps: string[] = [];
      setLive({ text, steps });
      try {
        const { trip: updated, changed } = await api.tripChat(trip.id, text, (step) => {
          steps.push(step);
          setLive({ text, steps: [...steps] });
        });
        const chat = updated.chat ?? [];
        if (chat.length) chat[chat.length - 1] = { ...chat[chat.length - 1], steps };
        queryClient.setQueryData(["trip", trip.id], { ...updated, chat });
        if (changed) {
          queryClient.invalidateQueries({ queryKey: ["trips"] });
          toast.success("Your plan was updated.");
        }
      } catch (error) {
        toast.error((error as Error).message);
      } finally {
        setLive(null);
      }
    },
    [live, trip.id, queryClient],
  );

  return { messages: trip.chat ?? [], live, send };
}

export function TripAssistant({ assistant, onClose }: { assistant: ReturnType<typeof useTripAssistant>; onClose: () => void }) {
  const { messages, live, send } = assistant;
  return (
    <div className="no-print fixed inset-0 z-50 flex justify-end bg-night/50 backdrop-blur-sm" onClick={onClose}>
      <aside
        className="glass-strong flex h-[100dvh] w-full flex-col overscroll-contain !rounded-none animate-rise sm:max-w-lg sm:!rounded-l-[2rem]"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-label="Trip assistant"
      >
        <header className="flex items-center justify-between border-b border-white/10 px-5 py-4 pt-[max(1rem,env(safe-area-inset-top))]">
          <div className="flex items-center gap-3">
            <Mark className="h-9 w-9" />
            <div>
              <p className="font-display text-lg leading-tight">Trip assistant</p>
              <p className="font-mono text-[10px] uppercase tracking-widest text-peacock">live web · weather · maps</p>
            </div>
          </div>
          <button className="btn-icon" onClick={onClose} aria-label="Close assistant"><X className="h-5 w-5" /></button>
        </header>
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-6">
          {!messages.length && !live ? (
            <div>
              <p className="text-mist">Ask anything about this trip, or tell me what to change. I'll check live information and update the plan for you.</p>
              <div className="mt-5 flex flex-wrap gap-2">
                {STARTERS.map((s) => <button key={s} onClick={() => send(s)} className="chip py-1.5 hover:bg-white/10">{s}</button>)}
              </div>
            </div>
          ) : (
            <Thread messages={messages} live={live} onSend={send} />
          )}
        </div>
        <div className="border-t border-white/10 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <Composer busy={Boolean(live)} placeholder="e.g. Swap day 2 for something indoors" onSend={send} autoFocus />
        </div>
      </aside>
    </div>
  );
}

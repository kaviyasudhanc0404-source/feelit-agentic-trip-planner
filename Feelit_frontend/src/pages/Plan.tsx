import { ArrowUpRight, Baby, Mountain, Palmtree, RotateCcw, Sunrise } from "lucide-react";
import { Composer } from "@/components/Composer";
import { Mark } from "@/components/Logo";
import { PostcardStream } from "@/components/Postcards";
import { Thread } from "@/components/Thread";
import { useConversation } from "@/context/conversation";

const STARTERS = [
  { icon: Mountain, title: "Hill escape", prompt: "Plan a relaxed hill-station trip from Chennai" },
  { icon: Palmtree, title: "Beach weekend", prompt: "A beach weekend with friends on a tight budget" },
  { icon: Baby, title: "Family holiday", prompt: "A 5-day family holiday with kids in December" },
  { icon: Sunrise, title: "Day trip near me", prompt: "Plan a one-day trip near me this Sunday" },
];

/** The planning chat with the agent. */
export default function Plan() {
  const { messages, live, send, reset } = useConversation();
  const empty = !messages.length && !live;

  return (
    <div className="mx-auto flex min-h-[calc(100svh-4rem)] max-w-3xl flex-col px-4">
      <div className="sticky top-16 z-20 -mx-4 flex items-center justify-between bg-gradient-to-b from-night via-night/90 to-transparent px-4 pb-6 pt-4">
        <div className="flex items-center gap-3">
          <Mark className="h-9 w-9" />
          <div>
            <p className="font-display text-xl leading-none">Feel It agent</p>
            <p className="mt-1 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-peacock"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-peacock" />Live web · weather · maps</p>
          </div>
        </div>
        {!empty && <button className="btn btn-ghost !py-2" onClick={reset} disabled={Boolean(live)}><RotateCcw className="h-4 w-4" />New chat</button>}
      </div>

      <div className="flex-1 pb-6">
        {empty ? (
          <div className="py-6">
            <p className="eyebrow">Plan with Feel It</p>
            <h1 className="mt-3 text-5xl leading-[0.95] sm:text-6xl">Tell me where your <span className="accent">heart</span> wants to go.</h1>
            <p className="mt-4 max-w-lg text-mist">I'll ask a few questions like a human planner would, check live places, weather and prices, then build a plan you can edit.</p>
            <PostcardStream direction="horizontal" className="-mx-4 mt-6" />
            <p className="rule mt-6">Or start with an idea</p>
            <ol className="mt-2 divide-y divide-white/[0.07]">
              {STARTERS.map(({ icon: Icon, title, prompt }, i) => (
                <li key={title}>
                  <button onClick={() => send(prompt)} className="group flex w-full items-center gap-4 py-4 text-left">
                    <span className="font-mono text-xs text-mist">0{i + 1}</span>
                    <Icon className="h-5 w-5 shrink-0 text-saffron" />
                    <span className="min-w-0 flex-1">
                      <span className="block font-display text-xl transition group-hover:text-saffron">{title}</span>
                      <span className="block text-sm text-mist">{prompt}</span>
                    </span>
                    <ArrowUpRight className="h-5 w-5 shrink-0 text-mist transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-saffron" />
                  </button>
                </li>
              ))}
            </ol>
          </div>
        ) : (
          <Thread messages={messages} live={live} onSend={send} />
        )}
      </div>

      <div className="dock-pad sticky bottom-0 z-20 -mx-4 bg-gradient-to-t from-night from-70% via-night/95 to-transparent px-4 pb-28 pt-6 md:pb-4">
        <Composer busy={Boolean(live)} placeholder="Ask anything, or answer in your own words…" onSend={send} autoFocus />
        <p className="mt-2 text-center font-mono text-[10px] text-mist/60">Live web, weather and maps. Always confirm prices before booking.</p>
      </div>
    </div>
  );
}

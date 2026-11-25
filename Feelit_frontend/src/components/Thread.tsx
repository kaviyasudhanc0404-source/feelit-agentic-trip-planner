import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, ExternalLink, Globe, Send } from "lucide-react";
import { Link } from "react-router-dom";
import { cx } from "@/lib/format";
import type { ChatMessage, Question } from "@/lib/types";
import { BriefCard } from "./BriefCard";
import { SpotCard } from "./cards";
import { AgentAvatar } from "./AgentAvatar";

/**
 * A conversation with the agent: messages, the tools it used, its questions, a trip brief,
 * place cards, sources and follow-up suggestions. Used by the planning chat and the trip assistant.
 */
export function Thread({ messages, live, onSend }: {
  messages: ChatMessage[];
  live: { text: string; steps: string[] } | null;
  onSend: (text: string) => void;
}) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, live?.steps.length]);

  const last = messages.length - 1;
  return (
    <div className="space-y-6">
      {messages.map((message, index) =>
        message.role === "user"
          ? <UserBubble key={index} text={message.text} />
          : <AgentMessage key={index} message={message} latest={index === last && !live} onSend={onSend} />,
      )}
      {live && (
        <>
          <UserBubble text={live.text} />
          <div className="flex gap-3">
            <AgentAvatar thinking />
            <div className="glass flex-1 px-4 py-3">
              <Steps steps={live.steps} running />
              <p className="flex items-center gap-1.5 text-sm text-mist">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-saffron" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-coral [animation-delay:.15s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-rani [animation-delay:.3s]" />
                <span className="ml-1">Thinking</span>
              </p>
            </div>
          </div>
        </>
      )}
      <div ref={end} className="scroll-mb-44" />
    </div>
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end animate-rise">
      <p className="max-w-[85%] whitespace-pre-line rounded-2xl rounded-br-sm bg-saffron/15 px-4 py-2.5 text-sm ring-1 ring-saffron/25">{text}</p>
    </div>
  );
}

function AgentMessage({ message, latest, onSend }: { message: ChatMessage; latest: boolean; onSend: (text: string) => void }) {
  return (
    <div className="flex animate-rise gap-3">
      <AgentAvatar />
      <div className="min-w-0 flex-1 space-y-4">
        {message.steps?.length ? <Steps steps={message.steps} /> : null}
        {message.text && <Reply text={message.text} />}
        {message.questions?.length ? <Questions questions={message.questions} active={latest} onSend={onSend} /> : null}
        {message.brief && <BriefCard brief={message.brief} active={latest} />}
        {message.places?.spots.length ? (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="eyebrow">Top places in {message.places.place.name}</p>
              <Link to={`/explore/${encodeURIComponent(message.places.place.label)}`} className="text-xs font-semibold text-sky hover:underline">Full guide →</Link>
            </div>
            <div className="scroll-row">
              {message.places.spots.map((spot, i) => <div key={i} className="w-52 shrink-0 snap-start"><SpotCard spot={spot} near={message.places!.place.label} /></div>)}
            </div>
          </div>
        ) : null}
        {message.sources?.length ? (
          <div className="flex flex-wrap gap-2">
            {message.sources.map((source) => (
              <a key={source.url} href={source.url} target="_blank" rel="noreferrer" className="chip max-w-[16rem] hover:bg-white/10">
                <Globe className="h-3 w-3 shrink-0 text-sky" /><span className="truncate">{new URL(source.url).hostname.replace("www.", "")}</span><ExternalLink className="h-3 w-3 shrink-0 opacity-50" />
              </a>
            ))}
          </div>
        ) : null}
        {latest && message.suggestions?.length ? (
          <div className="flex flex-wrap gap-2">
            {message.suggestions.map((s) => <button key={s} onClick={() => onSend(s)} className="chip border-saffron/30 hover:bg-saffron/10">{s}</button>)}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Plain-text reply; lines starting with "- " become a list. */
function Reply({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/);
  return (
    <div className="space-y-2 text-[15px] leading-relaxed text-snow/90">
      {blocks.map((block, i) => {
        const lines = block.split("\n");
        return lines.every((l) => /^\s*[-•*]\s/.test(l))
          ? <ul key={i} className="space-y-1">{lines.map((l, j) => <li key={j} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-saffron" />{l.replace(/^\s*[-•*]\s/, "")}</li>)}</ul>
          : <p key={i} className="whitespace-pre-line">{block}</p>;
      })}
    </div>
  );
}

/** What the agent did this turn: web searches, weather checks, place look-ups. */
function Steps({ steps, running = false }: { steps: string[]; running?: boolean }) {
  const [open, setOpen] = useState(running);
  if (!steps.length && !running) return null;
  return (
    <div className="font-mono text-xs text-mist">
      {!running && (
        <button onClick={() => setOpen(!open)} className="flex items-center gap-1 hover:text-snow">
          <Check className="h-3.5 w-3.5 text-peacock" /> Used {steps.length} live {steps.length === 1 ? "source" : "sources"}
          <ChevronDown className={cx("h-3.5 w-3.5 transition", open && "rotate-180")} />
        </button>
      )}
      {(open || running) && (
        <ol className="mb-2 mt-1 space-y-1 border-l border-white/10 pl-3">
          {steps.map((step, i) => <li key={i} className="animate-rise">{step}</li>)}
        </ol>
      )}
    </div>
  );
}

/** The agent's questions as a quick form: tap answers, or type your own. */
function Questions({ questions, active, onSend }: { questions: Question[]; active: boolean; onSend: (text: string) => void }) {
  const [answers, setAnswers] = useState<Record<number, string[]>>({});
  const [typed, setTyped] = useState<Record<number, string>>({});
  const pick = (index: number, option: string, multi: boolean) =>
    setAnswers((all) => {
      const current = all[index] ?? [];
      const next = multi ? (current.includes(option) ? current.filter((o) => o !== option) : [...current, option]) : [option];
      return { ...all, [index]: next };
    });
  const answerOf = (index: number) => [...(answers[index] ?? []), typed[index]?.trim()].filter(Boolean).join(", ");
  const answered = questions.filter((_, i) => answerOf(i)).length;

  const submit = () =>
    onSend(questions.map((q, i) => answerOf(i) && `${q.label} ${answerOf(i)}`).filter(Boolean).join("\n"));

  return (
    <div className={cx("glass-strong space-y-5 p-5", !active && "opacity-60")}>
      {questions.map((question, index) => (
        <fieldset key={index} disabled={!active}>
          <legend className="text-sm font-semibold">{question.label}</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {question.options.map((option) => {
              const on = answers[index]?.includes(option);
              return <button key={option} type="button" onClick={() => pick(index, option, question.multi)} className={cx("chip py-1.5 transition", on ? "chip-on" : "hover:bg-white/10")}>{on && <Check className="h-3 w-3" />}{option}</button>;
            })}
            <input
              value={typed[index] ?? ""}
              onChange={(e) => setTyped({ ...typed, [index]: e.target.value })}
              placeholder={question.options.length ? "Or type…" : "Type your answer"}
              className="min-w-[8rem] flex-1 rounded-full border border-white/10 bg-transparent px-3 py-1.5 text-xs focus:border-saffron/50 focus:outline-none"
            />
          </div>
        </fieldset>
      ))}
      {active && (
        <div className="flex items-center justify-between gap-3 border-t border-white/10 pt-4">
          <span className="font-mono text-xs text-mist">{answered}/{questions.length} answered</span>
          <button className="btn btn-primary" disabled={!answered} onClick={submit}><Send className="h-4 w-4" />Send answers</button>
        </div>
      )}
    </div>
  );
}

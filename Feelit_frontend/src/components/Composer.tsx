import { useEffect, useRef, useState } from "react";
import { ArrowUp, Mic, Square } from "lucide-react";
import { toast } from "sonner";
import { cx } from "@/lib/format";

/* eslint-disable @typescript-eslint/no-explicit-any -- the Web Speech API has no standard TypeScript types */
const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
/** Auto-focus only with a mouse or trackpad: on phones it would pop the keyboard over the page. */
const FINE_POINTER = window.matchMedia("(pointer: fine)").matches;

/** Speak instead of typing (Chrome, Edge and Safari). */
function useVoice(onText: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const session = useRef<any>(null);
  useEffect(() => () => session.current?.abort(), []);

  const toggle = () => {
    if (listening) return session.current?.stop();
    const recognition = new SpeechRecognition();
    recognition.lang = "en-IN";
    recognition.onresult = (event: any) => onText(event.results[0][0].transcript);
    recognition.onerror = () => toast.error("I couldn't hear that. Please try again.");
    recognition.onend = () => setListening(false);
    session.current = recognition;
    recognition.start();
    setListening(true);
  };
  return { supported: Boolean(SpeechRecognition), listening, toggle };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** The message box used to talk to the agent everywhere in the app. */
export function Composer({ onSend, busy = false, placeholder, large = false, autoFocus = false }: {
  onSend: (text: string) => void;
  busy?: boolean;
  placeholder: string;
  large?: boolean;
  autoFocus?: boolean;
}) {
  const [text, setText] = useState("");
  const box = useRef<HTMLTextAreaElement>(null);
  const voice = useVoice((heard) => setText((current) => (current ? `${current} ${heard}` : heard)));

  // If the screen turns into a touch screen while this box has focus (rotating a tablet, or the browser's
  // device toolbar), let go of the focus so the browser doesn't zoom in on it.
  useEffect(() => {
    const touch = window.matchMedia("(pointer: coarse)");
    const release = () => touch.matches && document.activeElement === box.current && box.current?.blur();
    touch.addEventListener("change", release);
    return () => touch.removeEventListener("change", release);
  }, []);

  useEffect(() => {
    const el = box.current!;
    el.style.height = "auto";
    if (text) el.style.height = `${Math.min(el.scrollHeight, 200)}px`; // empty: one row, however long the placeholder
  }, [text]);

  const submit = () => {
    if (!text.trim() || busy) return;
    onSend(text);
    setText("");
  };

  return (
    <form
      onSubmit={(event) => { event.preventDefault(); submit(); }}
      className={cx("glass-strong relative flex items-end gap-2 p-2 transition focus-within:border-saffron/40", large && "sm:p-3")}
    >
      <textarea
        ref={box}
        value={text}
        autoFocus={autoFocus && FINE_POINTER}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); submit(); } }}
        rows={1}
        enterKeyHint="send"
        maxLength={1000}
        placeholder={placeholder}
        aria-label="Message Feel It"
        className={cx("min-w-0 flex-1 resize-none bg-transparent px-3 py-2 text-snow placeholder:overflow-hidden placeholder:text-ellipsis placeholder:whitespace-nowrap placeholder:text-mist/60 focus:outline-none", large ? "text-base sm:text-lg" : "text-sm")}
      />
      {voice.supported && (
        <button type="button" onClick={voice.toggle} aria-label={voice.listening ? "Stop listening" : "Speak"} className={cx("btn-icon !h-11 !w-11 shrink-0", voice.listening && "animate-pulse border-coral bg-coral/20 text-coral")}>
          {voice.listening ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </button>
      )}
      <button type="submit" disabled={busy || !text.trim()} aria-label="Send" className="btn btn-primary h-11 w-11 shrink-0 !p-0">
        <ArrowUp className="h-5 w-5" />
      </button>
    </form>
  );
}

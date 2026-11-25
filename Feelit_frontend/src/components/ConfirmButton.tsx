import { useState, type ReactNode } from "react";
import { cx } from "@/lib/format";

/** A button that asks "Sure?" inline before doing something that can't be undone. */
export function ConfirmButton({ onConfirm, busy, children, question = "Delete?", className }: {
  onConfirm: () => void;
  busy?: boolean;
  children: ReactNode;
  question?: string;
  className?: string;
}) {
  const [asking, setAsking] = useState(false);
  if (!asking) {
    return <button type="button" className={className} onClick={(e) => { e.preventDefault(); setAsking(true); }} disabled={busy}>{children}</button>;
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-coral/40 bg-coral/10 py-1 pl-3 pr-1 text-xs font-semibold" onClick={(e) => e.preventDefault()}>
      {question}
      <button type="button" className={cx("rounded-full bg-coral px-2.5 py-1 font-bold text-night", busy && "opacity-60")} onClick={onConfirm} disabled={busy}>Yes</button>
      <button type="button" className="rounded-full px-2.5 py-1 text-snow hover:bg-white/10" onClick={() => setAsking(false)}>No</button>
    </span>
  );
}

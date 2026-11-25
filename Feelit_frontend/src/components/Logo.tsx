import { cx } from "@/lib/format";

/**
 * Feel It mark: an aeroplane taking off over a striped sunset, leaving a dotted trail.
 * The artwork lives in public/logo.svg so the browser-tab icon, app icons and this component share one file.
 */
export function Mark({ className }: { className?: string }) {
  return <img src="/logo.svg" alt="" aria-hidden width={48} height={48} className={cx("shrink-0 select-none", className)} draggable={false} />;
}

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cx("inline-flex items-center gap-2.5", className)}>
      <Mark className="h-9 w-9" />
      {!compact && (
        <span className="font-display text-[1.6rem] font-semibold leading-none tracking-tight text-snow">
          feel<span className="ml-[0.12em] pr-1 italic text-saffron">it</span>
          <span className="ml-0.5 inline-block h-1.5 w-1.5 rounded-full bg-peacock align-baseline" aria-hidden />
        </span>
      )}
    </span>
  );
}

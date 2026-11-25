import { useRef, type ReactNode } from "react";
import { cx } from "@/lib/format";
import { useAutoSlide } from "@/lib/slider";

/**
 * Cards that slide sideways by themselves on phones, with dots to jump between them.
 * From the `sm` breakpoint up, `className` / `itemClassName` lay the same cards out as a grid or list.
 */
export function SlideRow<T>({ items, label, render, className, itemClassName }: {
  items: T[];
  label: (item: T, index: number) => string;
  render: (item: T, index: number) => ReactNode;
  className?: string;
  itemClassName?: string;
}) {
  const row = useRef<HTMLOListElement>(null);
  const { active, go } = useAutoSlide(row, items.length);
  return (
    <>
      <ol ref={row} className={cx("flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 [scrollbar-width:none] sm:pb-0 [&::-webkit-scrollbar]:hidden", className)}>
        {items.map((item, index) => (
          <li key={label(item, index)} className={cx("w-[80%] shrink-0 snap-start sm:w-auto", itemClassName)}>{render(item, index)}</li>
        ))}
      </ol>
      <div className="mt-4 flex justify-center gap-1 sm:hidden">
        {items.map((item, index) => (
          <button key={label(item, index)} onClick={() => go(index)} aria-label={label(item, index)} className="flex h-6 items-center px-1">
            <span className={cx("h-1.5 rounded-full transition-all duration-300", index === active ? "w-6 bg-saffron" : "w-1.5 bg-white/25")} />
          </button>
        ))}
      </div>
    </>
  );
}

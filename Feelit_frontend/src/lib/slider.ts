import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

const REDUCED_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)");

/**
 * A horizontal row that slides to its next card every `interval` ms, but only while it is
 * actually a scrolling row (phones), visible on screen, and not being touched. Returns the card
 * in view and a way to jump to one (for the dots).
 */
export function useAutoSlide(row: RefObject<HTMLElement>, count: number, interval = 3500) {
  const [active, setActive] = useState(0);
  const pausedUntil = useRef(0);

  const go = useCallback((index: number) => {
    const el = row.current;
    const card = el?.children[index] as HTMLElement | undefined;
    if (el && card) el.scrollTo({ left: card.offsetLeft - el.offsetLeft, behavior: "smooth" });
  }, [row]);

  // Track which card is in view as the row scrolls (by finger or by the timer).
  useEffect(() => {
    const el = row.current;
    if (!el) return;
    const onScroll = () => {
      const width = (el.children[0] as HTMLElement | undefined)?.offsetWidth ?? 1;
      setActive(Math.min(count - 1, Math.round(el.scrollLeft / width)));
    };
    const pause = () => (pausedUntil.current = Date.now() + 8000);
    el.addEventListener("scroll", onScroll, { passive: true });
    el.addEventListener("pointerdown", pause);
    el.addEventListener("touchstart", pause, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      el.removeEventListener("pointerdown", pause);
      el.removeEventListener("touchstart", pause);
    };
  }, [row, count]);

  useEffect(() => {
    const el = row.current;
    if (!el || REDUCED_MOTION.matches) return;
    let visible = false;
    const watcher = new IntersectionObserver(([entry]) => (visible = entry.isIntersecting), { threshold: 0.5 });
    watcher.observe(el);
    const timer = window.setInterval(() => {
      const scrolls = el.scrollWidth > el.clientWidth + 4;
      if (!scrolls || !visible || Date.now() < pausedUntil.current) return;
      setActive((current) => {
        const next = (current + 1) % count;
        go(next);
        return next;
      });
    }, interval);
    return () => {
      watcher.disconnect();
      window.clearInterval(timer);
    };
  }, [row, count, interval, go]);

  return { active, go };
}

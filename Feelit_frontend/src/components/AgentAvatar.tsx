import { useId } from "react";
import { cx } from "@/lib/format";

/**
 * The agent's face in a conversation: a compass whose needle gently looks around, with a little
 * aeroplane flying round it. While the agent is working (`thinking`), the needle spins to find the
 * way, the plane speeds up and a soft pulse glows behind it.
 */
export function AgentAvatar({ thinking = false, className }: { thinking?: boolean; className?: string }) {
  const id = useId();
  const ring = `${id}-ring`;
  const dial = `${id}-dial`;
  return (
    <span className={cx("relative inline-flex h-9 w-9 shrink-0", className)} role="img" aria-label={thinking ? "Feel It is working" : "Feel It"}>
      {thinking && <span className="absolute inset-0 animate-ping rounded-full bg-saffron/30" />}
      <svg viewBox="0 0 40 40" className="relative h-full w-full" aria-hidden>
        <defs>
          <linearGradient id={ring} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#FFB55E" />
            <stop offset="1" stopColor="#22C3B5" />
          </linearGradient>
          <radialGradient id={dial} cx=".4" cy=".35" r=".75">
            <stop offset="0" stopColor="#1D2A4A" />
            <stop offset="1" stopColor="#0B1020" />
          </radialGradient>
        </defs>
        <circle cx="20" cy="20" r="18.75" fill="#0E1426" stroke={`url(#${ring})`} strokeWidth="1.5" />
        <circle cx="20" cy="20" r="14" fill="none" stroke="#F5F1E8" strokeOpacity=".25" strokeWidth=".9" strokeDasharray=".1 2.6" strokeLinecap="round" />
        <circle cx="20" cy="20" r="9" fill={`url(#${dial})`} stroke="#22C3B5" strokeOpacity=".6" strokeWidth=".8" />
        {/* compass rose: the four points, with tick marks between them */}
        <path d="M20 12.2l1.1 6.7 6.7 1.1-6.7 1.1-1.1 6.7-1.1-6.7-6.7-1.1 6.7-1.1z" fill="#F5F1E8" fillOpacity=".18" />
        <path d="M14.6 14.6l.9.9M25.4 14.6l-.9.9M14.6 25.4l.9-.9M25.4 25.4l-.9-.9" stroke="#F5F1E8" strokeOpacity=".35" strokeWidth=".7" strokeLinecap="round" />
        <g className={cx("origin-center [transform-box:view-box]", thinking ? "animate-needle-spin" : "animate-needle")}>
          <path d="M20 13.2l2 6.8h-4z" fill="#FF5D73" />
          <path d="M20 26.8l-2-6.8h4z" fill="#F5F1E8" />
          <circle cx="20" cy="20" r="1.2" fill="#FFB55E" />
        </g>
        <g className={cx("origin-center [transform-box:view-box]", thinking ? "animate-orbit-fast" : "animate-orbit")}>
          <g transform="translate(20 6) scale(.42)" fill="#FFB55E">
            <path d="M-9.5-1.4H7.2a2.6 1.4 0 0 1 0 2.8H-9.5z" />
            <path d="M-1.6-1.2-6.4-9.2h2.9l6.9 8z" />
            <path d="M-1.6 1.2-6.4 9.2h2.9l6.9-8z" />
            <path d="M-8.4-1.2-10.8-5h1.7l3.2 3.8zM-8.4 1.2-10.8 5h1.7l3.2-3.8z" />
          </g>
        </g>
      </svg>
    </span>
  );
}

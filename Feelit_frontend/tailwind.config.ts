import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        night: "#070A13",
        deep: "#0D1324",
        panel: "#121A2F",
        snow: "#F5F1E8",
        mist: "#9BA3B7",
        saffron: "#FF9F45",
        coral: "#FF5D73",
        rani: "#E8378E",
        peacock: "#22C3B5",
        sky: "#7CC6FF",
        gold: "#F7C948",
        // Trip layouts are themeable (dark night or light paper) through these CSS variables.
        ink: "rgb(var(--ink) / <alpha-value>)",
        muted: "rgb(var(--muted) / <alpha-value>)",
        tint: "rgb(var(--tint) / <alpha-value>)",
        tint2: "rgb(var(--tint-2) / <alpha-value>)",
        tintink: "rgb(var(--tint-ink) / <alpha-value>)",
      },
      borderColor: {
        line: "var(--line)",
      },
      fontFamily: {
        display: ['"Fraunces"', "Georgia", "serif"],
        sans: ['"Manrope"', "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "monospace"],
        hand: ['"Caveat"', "cursive"],
      },
      boxShadow: {
        glow: "0 12px 40px -12px rgba(255, 93, 115, 0.6)",
        lift: "0 24px 60px -28px rgba(0, 0, 0, 0.9)",
      },
      keyframes: {
        rise: { from: { opacity: "0", transform: "translateY(14px)" }, to: { opacity: "1", transform: "none" } },
        "scroll-y": { to: { transform: "translateY(-50%)" } },
        "scroll-x": { to: { transform: "translateX(-50%)" } },
        shimmer: { to: { backgroundPosition: "-200% 0" } },
        trail: { to: { strokeDashoffset: "-28" } },
        float: { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-6px)" } },
        kenburns: { from: { transform: "scale(1.12)" }, to: { transform: "scale(1)" } },
        orbit: { to: { transform: "rotate(360deg)" } },
        needle: { "0%,100%": { transform: "rotate(-18deg)" }, "50%": { transform: "rotate(22deg)" } },
      },
      animation: {
        rise: "rise .6s cubic-bezier(.2,.7,.2,1) both",
        "scroll-y": "scroll-y 40s linear infinite",
        "scroll-x": "scroll-x 50s linear infinite",
        shimmer: "shimmer 1.6s linear infinite",
        trail: "trail 1.1s linear infinite",
        float: "float 5s ease-in-out infinite",
        kenburns: "kenburns 18s ease-out both",
        orbit: "orbit 12s linear infinite",
        "orbit-fast": "orbit 2.4s linear infinite",
        needle: "needle 4s ease-in-out infinite",
        "needle-spin": "orbit 1.2s cubic-bezier(.5,.1,.3,1) infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;

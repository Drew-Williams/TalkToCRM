import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

// Corner's dark "HUD" theme — see src/styles/globals.css for the actual
// token values. Colors use the "hsl(var(--x) / <alpha-value>)" pattern
// (rather than a bare "hsl(var(--x))") specifically so utilities like
// bg-card/40 or border-border/50 can vary opacity per-usage, which the
// translucent card/surface look throughout the side panel relies on.
export default {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border) / <alpha-value>)",
        input: "hsl(var(--input) / <alpha-value>)",
        ring: "hsl(var(--ring) / <alpha-value>)",
        background: "hsl(var(--background) / <alpha-value>)",
        foreground: "hsl(var(--foreground) / <alpha-value>)",
        primary: {
          DEFAULT: "hsl(var(--primary) / <alpha-value>)",
          foreground: "hsl(var(--primary-foreground) / <alpha-value>)",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary) / <alpha-value>)",
          foreground: "hsl(var(--secondary-foreground) / <alpha-value>)",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive) / <alpha-value>)",
          foreground: "hsl(var(--destructive-foreground) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "hsl(var(--muted) / <alpha-value>)",
          foreground: "hsl(var(--muted-foreground) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "hsl(var(--accent) / <alpha-value>)",
          foreground: "hsl(var(--accent-foreground) / <alpha-value>)",
        },
        popover: {
          DEFAULT: "hsl(var(--popover) / <alpha-value>)",
          foreground: "hsl(var(--popover-foreground) / <alpha-value>)",
        },
        card: {
          DEFAULT: "hsl(var(--card) / <alpha-value>)",
          foreground: "hsl(var(--card-foreground) / <alpha-value>)",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        // Idle "Talk about this deal" hero CTA — a soft glow ring expanding
        // and fading, drawing the eye without being distracting. Color is
        // mycornercoach.com's brand red (--red, see globals.css), not an
        // independently-invented accent.
        "pulse-glow": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(180, 62, 54, 0.45)" },
          "50%": { boxShadow: "0 0 0 10px rgba(180, 62, 54, 0)" },
        },
        // Connecting/"thinking" state — a light sweep across a skeleton bar.
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        // Calmer, slower bar motion for "the agent is listening."
        "wave-listening": {
          "0%, 100%": { transform: "scaleY(0.4)" },
          "50%": { transform: "scaleY(1)" },
        },
        // Faster, less regular bar motion for "the agent is speaking" —
        // reads as more "reactive" than the listening pulse even though
        // neither is actually driven by real audio amplitude.
        "wave-speaking": {
          "0%, 100%": { transform: "scaleY(0.3)" },
          "25%": { transform: "scaleY(1)" },
          "50%": { transform: "scaleY(0.5)" },
          "75%": { transform: "scaleY(0.9)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "pulse-glow": "pulse-glow 2.2s ease-in-out infinite",
        shimmer: "shimmer 1.8s linear infinite",
        "wave-listening": "wave-listening 1.6s ease-in-out infinite",
        "wave-speaking": "wave-speaking 0.9s ease-in-out infinite",
      },
    },
  },
  plugins: [tailwindcssAnimate],
} satisfies Config;

import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#4f46e5",
          50: "#eef2ff",
          100: "#e0e7ff",
          200: "#c7d2fe",
          400: "#818cf8",
          500: "#6366f1",
          600: "#4f46e5",
          700: "#4338ca",
          800: "#3730a3",
          900: "#312e81",
          soft: "#eef2ff",
          hover: "#4338ca",
        },
        accent: {
          DEFAULT: "#10b981",
          soft: "#d1fae5",
        },
        surface: "#fafafa",
        panel: "#ffffff",
        ink: {
          DEFAULT: "#0f172a",
          muted: "#64748b",
          faint: "#94a3b8",
        },
        hairline: "#e5e7eb",
        score: {
          bad: "#ef4444",
          warn: "#f59e0b",
          good: "#10b981",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(15,23,42,0.04), 0 4px 12px rgba(15,23,42,0.04), 0 12px 32px -8px rgba(15,23,42,0.06)",
        "card-lg": "0 1px 2px rgba(15,23,42,0.05), 0 8px 24px rgba(15,23,42,0.06), 0 24px 56px -12px rgba(15,23,42,0.12)",
        glow: "0 0 0 4px rgba(79,70,229,0.2)",
      },
      keyframes: {
        "fade-in-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shine: {
          "0%": { transform: "translateX(-120%) skewX(-20deg)" },
          "100%": { transform: "translateX(220%) skewX(-20deg)" },
        },
        scan: {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        pulseGlow: {
          "0%,100%": { opacity: "0.6" },
          "50%": { opacity: "1" },
        },
        shake: {
          "0%,100%": { transform: "translateX(0)" },
          "25%": { transform: "translateX(-4px)" },
          "75%": { transform: "translateX(4px)" },
        },
        barFill: {
          "0%": { width: "0%" },
          "100%": { width: "var(--bar-pct)" },
        },
      },
      animation: {
        "fade-in-up": "fade-in-up 400ms ease-out both",
        shine: "shine 1.1s ease-out",
        scan: "scan 2s linear infinite",
        pulseGlow: "pulseGlow 1.6s ease-in-out infinite",
        shake: "shake 240ms ease-in-out",
        barFill: "barFill 900ms cubic-bezier(0.22,1,0.36,1) both",
      },
    },
  },
  plugins: [],
};

export default config;

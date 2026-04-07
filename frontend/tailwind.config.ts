import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: "#0f172a",
          secondary: "#1e293b",
          hover: "#334155",
          border: "#334155",
        },
        accent: {
          DEFAULT: "#6366f1",
          hover: "#4f46e5",
        },
      },
      animation: {
        "typing": "typing 1.2s infinite",
        "fade-in": "fadeIn 0.15s ease-out",
      },
      keyframes: {
        typing: {
          "0%, 60%, 100%": { opacity: "0.2", transform: "scale(0.8)" },
          "30%": { opacity: "1", transform: "scale(1)" },
        },
        fadeIn: {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;

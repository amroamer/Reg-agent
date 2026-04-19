import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // KPMG legacy palette (kept for admin pages)
        kpmg: {
          blue: "#00338D",
          "blue-dark": "#002266",
          "blue-light": "#0056A0",
          purple: "#483698",
          teal: "#009A9A",
          green: "#009A44",
          dark: "#1D1D1B",
        },
        sama: "#00338D",
        cma: "#483698",
        bank: "#009A44",

        // NEW: Editorial search palette
        ink: {
          DEFAULT: "#16181D",   // primary text
          soft: "#1E2A52",      // accent / brand
          muted: "#686D76",     // secondary text
        },
        paper: {
          DEFAULT: "#F7F7F5",   // page background (warm cream)
          line: "#E6E4DF",      // borders / dividers
          soft: "#F2F1EE",      // hover / subtle fills
          tan: "#D6D3CC",       // stronger dividers
        },
        mark: {
          DEFAULT: "#FFE89A",   // search term highlight
          soft: "#FFF7DD",      // soft highlight backgrounds
        },
      },
      fontFamily: {
        sans: ["Inter", "Noto Sans Arabic", "sans-serif"],
        arabic: ["IBM Plex Sans Arabic", "Noto Sans Arabic", "sans-serif"],
        mono: ["IBM Plex Mono", "monospace"],
        display: ["Inter", "sans-serif"],
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};

export default config;

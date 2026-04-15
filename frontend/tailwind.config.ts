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
      },
      fontFamily: {
        sans: ["Inter", "Noto Sans Arabic", "sans-serif"],
        arabic: ["IBM Plex Sans Arabic", "Noto Sans Arabic", "sans-serif"],
        mono: ["IBM Plex Mono", "monospace"],
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};

export default config;

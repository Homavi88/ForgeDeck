/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#070709",
          900: "#0d0d10",
          800: "#141418",
          700: "#1c1c22",
          600: "#26262e",
        },
        line: "#2e2e38",
        accent: "#ff6a00",
        mint: "#3dff7a",
        cyan: "#3dfff3",
        warn: "#ffd23f",
        danger: "#ff3b3b",
      },
      fontFamily: {
        sans: ["IBM Plex Sans", "Inter", "system-ui", "sans-serif"],
        mono: ["IBM Plex Mono", "ui-monospace", "monospace"],
      },
      boxShadow: {
        panel: "inset 0 1px 0 rgba(255,255,255,0.04), 0 8px 24px rgba(0,0,0,0.35)",
      },
    },
  },
  plugins: [],
};

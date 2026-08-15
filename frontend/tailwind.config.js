/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#0B0D10",
        paper: "#F6F5F1",
        vault: "#14181D",
        wire: "#2B323A",
        signal: "#5EEAD4",
        amber: "#E8A33D",
        danger: "#E2665B",
      },
      fontFamily: {
        display: ["'IBM Plex Mono'", "monospace"],
        body: ["'Inter'", "sans-serif"],
      },
    },
  },
  plugins: [],
};

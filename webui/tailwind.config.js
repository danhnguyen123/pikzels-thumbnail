/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0b0d12",
        panel: "#12151c",
        card: "#171b24",
        border: "#232935",
        muted: "#8b93a7",
        text: "#e6e9f0",
        brand: "#ef4444",
        brand2: "#f97316",
        accent: "#22d3ee",
      },
    },
  },
  plugins: [],
};

import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bread: "#8B5A3C",
        paper: "#FAF7F2",
        ink: "#2A2A2A",
        muted: "#6B6B6B",
        blue: "#2563EB",
        amber: "#D97706",
        green: "#15803D",
        red: "#DC2626"
      },
      borderRadius: {
        control: "6px",
        panel: "8px"
      },
      boxShadow: {
        panel: "0 1px 3px rgba(0,0,0,0.08)"
      }
    }
  },
  plugins: []
} satisfies Config;

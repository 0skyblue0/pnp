import type { Config } from "tailwindcss";

export default {
  content: {
    relative: true,
    files: ["./index.html", "./src/**/*.{ts,tsx}"]
  },
  theme: {
    extend: {
      colors: {
        bread: "#8A5A3A",
        paper: "#F8F3EA",
        ink: "#2B2118",
        muted: "#75685B",
        cream: "#FFFDF8",
        latte: "#E7D7C5",
        cocoa: "#5A3824",
        blue: "#425CC7",
        amber: "#B76A1E",
        green: "#197A4A",
        red: "#C24136"
      },
      borderRadius: {
        control: "12px",
        panel: "22px"
      },
      boxShadow: {
        panel:
          "0 24px 64px rgba(67, 44, 27, 0.12), 0 1px 0 rgba(255,255,255,0.92) inset",
        control: "0 10px 22px rgba(74, 48, 29, 0.10)",
        elegant: "0 18px 42px rgba(80, 52, 31, 0.16)"
      }
    }
  },
  plugins: []
} satisfies Config;

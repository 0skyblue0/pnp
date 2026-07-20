import type { Config } from "tailwindcss";

export default {
  content: {
    relative: true,
    files: ["./index.html", "./src/**/*.{ts,tsx}"]
  },
  theme: {
    extend: {
      colors: {
        "ref-cocoa": "var(--ref-cocoa)",
        "ref-gold": "var(--ref-gold)",
        "ref-gold-strong": "var(--ref-gold-strong)",
        "ref-canvas": "var(--ref-canvas)",
        "ref-work-surface": "var(--ref-work-surface)",
        "ref-header": "var(--ref-header)",
        "ref-card": "var(--ref-card)",
        "ref-line": "var(--ref-line)",
        "ref-line-strong": "var(--ref-line-strong)",
        "ref-line-subtle": "var(--ref-line-subtle)",
        "ref-line-warm": "var(--ref-line-warm)",
        "ref-line-faint": "var(--ref-line-faint)",
        "ref-table-head": "var(--ref-table-head)",
        "ref-gold-soft": "var(--ref-gold-soft)",
        "ref-gold-wash": "var(--ref-gold-wash)",
        "ref-warning-wash": "var(--ref-warning-wash)",
        "ref-warning-strong": "var(--ref-warning-strong)",
        "ref-peach-wash": "var(--ref-peach-wash)",
        "ref-info-wash": "var(--ref-info-wash)",
        "ref-info-strong": "var(--ref-info-strong)",
        "ref-success-wash": "var(--ref-success-wash)",
        "ref-danger-wash": "var(--ref-danger-wash)",
        "ref-info-soft": "var(--ref-info-soft)",
        "ref-alert-line": "var(--ref-alert-line)",
        "ref-alert-wash": "var(--ref-alert-wash)",
        "ref-info-line": "var(--ref-info-line)",
        "ref-text": "var(--ref-text)",
        "ref-text-secondary": "var(--ref-text-secondary)",
        "ref-muted": "var(--ref-muted)",
        "ref-text-subtle": "var(--ref-text-subtle)",
        "ref-sidebar-inactive": "var(--ref-sidebar-inactive)",
        "ref-sidebar-muted": "var(--ref-sidebar-muted)",
        "ref-sidebar-muted-soft": "var(--ref-sidebar-muted-soft)",
        "ref-success": "var(--ref-success)",
        "ref-warning": "var(--ref-warning)",
        "ref-danger": "var(--ref-danger)",
        "ref-notice": "var(--ref-notice)",
        "ref-info": "var(--ref-info)",
        "ref-comparison": "var(--ref-comparison)",
        canvas: "#EDE7DF",
        surface: "#FFFFFF",
        "surface-muted": "#F7F3EC",
        border: "#E9E1D3",
        foreground: "#2B2621",
        subtle: "#8A7F72",
        brand: "#B5654A",
        "brand-strong": "#8C4A32",
        info: "#425CC7",
        warning: "#B76A1E",
        success: "#197A4A",
        danger: "#C24136",
        bread: "#B5654A",
        paper: "#EDE7DF",
        ink: "#2B2621",
        muted: "#8A7F72",
        cream: "#F7F3EC",
        latte: "#E9E1D3",
        cocoa: "#8C4A32",
        blue: "#425CC7",
        amber: "#B76A1E",
        green: "#197A4A",
        red: "#C24136"
      },
      borderRadius: {
        sm: "8px",
        control: "9px",
        panel: "12px"
      },
      boxShadow: {
        panel:
          "0 1px 0 rgba(255,255,255,0.86) inset, 0 12px 28px rgba(43,38,34,0.06)",
        control: "0 8px 18px rgba(43,38,34,0.07)",
        elegant: "0 16px 34px rgba(43,38,34,0.13)"
      }
    }
  },
  plugins: []
} satisfies Config;

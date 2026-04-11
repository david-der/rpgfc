// Tailwind config — verbatim from Design & Style Guide §12 with exactly the
// structural extensions Story 00 needs (content globs, font fallbacks).
//
// Do NOT edit palette values, radii, shadows, or typography scale in this
// file without updating the Style Guide first. AC-16 asserts:
//   - every theme.borderRadius key except 'full' is "0"
//   - every theme.boxShadow key is "none"

import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx,html}", "./index.html"],
  theme: {
    extend: {
      colors: {
        parchment: {
          50: "#FAF7F0",
          100: "#F5F1E6",
          200: "#E8E2D1",
          300: "#D6CDB6",
          400: "#B6A98A",
          500: "#8F8264",
          600: "#6A6048",
          700: "#4B4432",
          800: "#2E2A1F",
          900: "#1A1812",
        },
        moss: {
          50: "#F0F2E8",
          100: "#DDE3C9",
          200: "#BDC79A",
          300: "#97A56A",
          400: "#758547",
          500: "#5C6B33", // primary accent (default)
          600: "#485527",
          700: "#363F1E",
          800: "#252B15",
          900: "#171C0D",
        },
        clay: {
          50: "#F8EEE3",
          100: "#EDD5BC",
          200: "#D9AE83",
          300: "#C28A57",
          400: "#A67040",
          500: "#865732",
          600: "#6A4225",
          700: "#4C2F1A",
          800: "#321E11",
          900: "#1D1108",
        },
        form: {
          excellent: "#5B8C4D",
          good: "#8FA84A",
          average: "#C49B3D",
          poor: "#B37238",
          dreadful: "#9C4B2F",
        },
        result: {
          win: "#5B8C4D",
          draw: "#A89878",
          loss: "#9C4B2F",
        },
        semantic: {
          success: "#5B8C4D",
          warning: "#C49B3D",
          error: "#9C4B2F",
          info: "#5C7A83",
        },
        club: {
          primary: "var(--club-primary)",
          "primary-ink": "var(--club-primary-ink)",
          "primary-soft": "var(--club-primary-soft)",
          secondary: "var(--club-secondary)",
          "secondary-ink": "var(--club-secondary-ink)",
          stripe: "var(--club-stripe)",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        serif: ["Newsreader", "Georgia", "serif"],
        mono: ['"JetBrains Mono"', "Consolas", "monospace"],
      },
      fontSize: {
        xs: ["12px", { lineHeight: "16px" }],
        sm: ["14px", { lineHeight: "20px" }],
        base: ["16px", { lineHeight: "24px" }],
        lg: ["18px", { lineHeight: "28px" }],
        xl: ["20px", { lineHeight: "28px" }],
        "2xl": ["24px", { lineHeight: "32px" }],
        "3xl": ["30px", { lineHeight: "36px" }],
        "4xl": ["36px", { lineHeight: "40px" }],
        "5xl": ["48px", { lineHeight: "48px" }],
      },
      borderRadius: {
        none: "0",
        sm: "0",
        DEFAULT: "0",
        md: "0",
        lg: "0",
        xl: "0",
        "2xl": "0",
        "3xl": "0",
        full: "9999px",
      },
      boxShadow: {
        none: "none",
        DEFAULT: "none",
        sm: "none",
        md: "none",
        lg: "none",
        xl: "none",
      },
      transitionDuration: {
        DEFAULT: "150ms",
      },
      transitionTimingFunction: {
        DEFAULT: "cubic-bezier(0, 0, 0.2, 1)",
      },
      maxWidth: {
        prose: "40rem",
      },
    },
  },
  plugins: [],
} satisfies Config;

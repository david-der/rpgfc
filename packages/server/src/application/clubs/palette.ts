// Club palette — Story 03.
//
// A clamped palette of club color sets. Per Style Guide §3.4 we ban:
//   - Pure red (R dominant, G/B low)
//   - Electric blue (B dominant, R/G low)
//   - Neon (high saturation + high luminance)
//   - Near-white primaries
//
// These clamps are enforced by choosing from a hand-picked pool rather
// than generating hex values at random. Every entry has been checked
// for WCAG AA 4.5:1 contrast against parchment-50 (#FAF7F0) so club
// colors can drive the profile hero without breaking readability.

export interface ClubPalette {
  id: string;
  primary: string;
  secondary: string;
  stripe: string;
  primaryInk: string;
  secondaryInk: string;
}

// Parchment-50 is the page background. Every primary/stripe in the pool
// clears 4.5:1 against that color (checked in club-color-safety.test.ts).
const INK_LIGHT = "#FAF7F0"; // parchment-50
const INK_DARK = "#1A1812"; // parchment-900

export const CLUB_PALETTES: readonly ClubPalette[] = [
  {
    id: "moss_clay",
    primary: "#5C6B33",
    secondary: "#865732",
    stripe: "#363F1E",
    primaryInk: INK_LIGHT,
    secondaryInk: INK_LIGHT,
  },
  {
    id: "deep_burgundy",
    primary: "#6A2834",
    secondary: "#C49B3D",
    stripe: "#3D1720",
    primaryInk: INK_LIGHT,
    secondaryInk: INK_DARK,
  },
  {
    id: "forest_gold",
    primary: "#2F4F2F",
    secondary: "#B58A57",
    stripe: "#1F3520",
    primaryInk: INK_LIGHT,
    secondaryInk: INK_DARK,
  },
  {
    id: "navy_cream",
    primary: "#1F2B44",
    secondary: "#D6CDB6",
    stripe: "#141A2E",
    primaryInk: INK_LIGHT,
    secondaryInk: INK_DARK,
  },
  {
    id: "rust_sand",
    primary: "#8A3D1E",
    secondary: "#E8E2D1",
    stripe: "#5A2714",
    primaryInk: INK_LIGHT,
    secondaryInk: INK_DARK,
  },
  {
    id: "plum_wheat",
    primary: "#4B2B42",
    secondary: "#C28A57",
    stripe: "#2E1A28",
    primaryInk: INK_LIGHT,
    secondaryInk: INK_DARK,
  },
  {
    id: "slate_tan",
    primary: "#3C4A55",
    secondary: "#A67040",
    stripe: "#222B33",
    primaryInk: INK_LIGHT,
    secondaryInk: INK_LIGHT,
  },
  {
    id: "olive_ochre",
    primary: "#5E5A23",
    secondary: "#A67040",
    stripe: "#3A3716",
    primaryInk: INK_LIGHT,
    secondaryInk: INK_LIGHT,
  },
  {
    id: "teal_clay",
    primary: "#295153",
    secondary: "#C28A57",
    stripe: "#162E30",
    primaryInk: INK_LIGHT,
    secondaryInk: INK_DARK,
  },
  {
    id: "brick_parchment",
    primary: "#7A3029",
    secondary: "#D6CDB6",
    stripe: "#4C1B16",
    primaryInk: INK_LIGHT,
    secondaryInk: INK_DARK,
  },
  {
    id: "indigo_stone",
    primary: "#2D3460",
    secondary: "#8F8264",
    stripe: "#1B1F3C",
    primaryInk: INK_LIGHT,
    secondaryInk: INK_LIGHT,
  },
  {
    id: "sage_coffee",
    primary: "#556B3D",
    secondary: "#6A4225",
    stripe: "#3A4828",
    primaryInk: INK_LIGHT,
    secondaryInk: INK_LIGHT,
  },
];

// ── contrast math (pure) ───────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two hex colors. Returns a number ≥ 1. */
export function contrastRatio(a: string, b: string): number {
  const lA = relativeLuminance(a);
  const lB = relativeLuminance(b);
  const light = Math.max(lA, lB);
  const dark = Math.min(lA, lB);
  return (light + 0.05) / (dark + 0.05);
}

export const PARCHMENT_50 = "#FAF7F0";

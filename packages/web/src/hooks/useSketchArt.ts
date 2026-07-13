// useSketchArt — resolves sketch art for a folder + key against the
// drop-in asset convention. GPT Image 2 output lands as .webp; earlier
// Gemini pieces are .png. On load error the src walks:
//
//   {key}.webp → {key}.png → default-{fallback}.webp → default.webp → default.png
//
// The optional fallback key selects a position-generic silhouette
// (gk / defender / midfielder / forward) so a player without art shows
// an anonymous figure — never another player's face. State resets when
// the target changes, so long-lived consumers (list rows, modals)
// never show the previous player's art.

import { useState } from "react";

/** Map a UI position label ("GK", "CB · Stopper", "ST") onto the
 *  silhouette family used for default art. */
export function artFamilyFor(positionLabel: string): string {
  const upper = positionLabel.toUpperCase();
  if (upper.includes("GK")) return "gk";
  if (/CB|FB|LB|RB|WB|DF/.test(upper)) return "defender";
  if (/DM|CM|AM|MF|LM|RM/.test(upper)) return "midfielder";
  return "forward";
}

export function useSketchArt(folder: string, artKey: string | number, fallbackKey?: string) {
  const target = `${folder}/${artKey}/${fallbackKey ?? ""}`;
  const [state, setState] = useState({ target, step: 0 });
  if (state.target !== target) setState({ target, step: 0 });
  const step = state.target === target ? state.step : 0;

  const candidates = [
    `/${folder}/${artKey}.webp`,
    `/${folder}/${artKey}.png`,
    ...(fallbackKey ? [`/${folder}/default-${fallbackKey}.webp`] : []),
    `/${folder}/default.webp`,
    `/${folder}/default.png`,
  ];
  const src = candidates[Math.min(step, candidates.length - 1)]!;
  const onError = () =>
    setState((s) =>
      s.target === target && s.step < candidates.length - 1 ? { target, step: s.step + 1 } : s,
    );

  return { src, onError };
}

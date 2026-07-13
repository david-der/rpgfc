// useSketchArt — resolves sketch art for a folder + key against the
// drop-in asset convention. GPT Image 2 output lands as .webp; the
// original Gemini corpus is .png. On load error the src walks:
//
//   {key}.webp → {key}.png → default.webp → default.png
//
// so either format lights up without code changes. State resets when
// the target changes, so long-lived consumers (list rows, modals)
// never show the previous player's art.

import { useState } from "react";

export function useSketchArt(folder: string, artKey: string | number) {
  const target = `${folder}/${artKey}`;
  const [state, setState] = useState({ target, step: 0 });
  if (state.target !== target) setState({ target, step: 0 });
  const step = state.target === target ? state.step : 0;

  const candidates = [
    `/${target}.webp`,
    `/${target}.png`,
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

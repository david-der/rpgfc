// NarrativeBlock — Style Guide §4.4, §6.1.
//
// Long-form prose reading surface. Newsreader serif, text-lg, leading-
// relaxed, max-w-prose (640px). Never wider. An optional drop-cap on the
// first letter of the lead paragraph, rendered via the `first-letter`
// utility when the `dropCap` prop is set.
//
// Player-facing flag (Story 03):
//   By default this block carries data-testid="player-facing" so the
//   doctrine suite can scrape it. Editorial output that is allowed to
//   contain digits — scout reports, match reports, news copy — should
//   pass `playerFacing={false}` to opt out. Story 03's spec calls this
//   out explicitly: scout report bodies are editorial, not raw player
//   facts.

import type { ReactNode } from "react";

interface NarrativeBlockProps {
  children: ReactNode;
  dropCap?: boolean;
  /** Visible to the screen reader as the block's landmark. */
  label?: string;
  /** Defaults to true. Set false on editorial copy that is allowed
   *  to contain digits (scout reports, match reports). */
  playerFacing?: boolean;
}

export function NarrativeBlock({
  children,
  dropCap = false,
  label,
  playerFacing = true,
}: NarrativeBlockProps) {
  const dropCapClass = dropCap
    ? "first-letter:font-serif first-letter:text-5xl first-letter:font-medium first-letter:text-moss-500 first-letter:float-left first-letter:mr-2 first-letter:leading-none"
    : "";
  return (
    <article
      className={`max-w-prose space-y-4 font-serif text-lg leading-relaxed text-parchment-800 ${dropCapClass}`}
      data-testid={playerFacing ? "player-facing" : undefined}
      aria-label={label}
    >
      {children}
    </article>
  );
}

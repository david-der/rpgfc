// PromiseMoodChip — Story 05.
//
// Per-player mood chip. Rendered on /squad rows and on /players/:id
// next to Certainty. The label is a short prose template — never a
// numeric mood score. The chip pairs color with font weight +
// italic so the mood reads without color (Style Guide §2).

import type { PromiseMood } from "@rpgfc/shared";

interface PromiseMoodChipProps {
  mood: PromiseMood;
  label: string;
}

const MOOD_CLASS: Record<PromiseMood, string> = {
  Eager: "border-moss-600 text-moss-700 font-semibold",
  Content: "border-moss-500 text-moss-700 font-medium",
  Concerned: "border-parchment-500 text-parchment-700 font-medium italic",
  Disappointed: "border-clay-500 text-clay-700 font-semibold italic",
  Furious: "border-clay-600 text-clay-700 font-bold italic",
};

const MOOD_WORD: Record<PromiseMood, string> = {
  Eager: "Eager",
  Content: "Content",
  Concerned: "Concerned",
  Disappointed: "Disappointed",
  Furious: "Furious",
};

export function PromiseMoodChip({ mood, label }: PromiseMoodChipProps) {
  return (
    <div className={`inline-flex max-w-prose flex-col border bg-parchment-50 px-3 py-1 ${MOOD_CLASS[mood]}`}>
      <span className="font-sans text-xs uppercase tracking-wide">{MOOD_WORD[mood]}</span>
      <span
        data-testid="player-facing"
        className="mt-1 font-serif text-sm text-parchment-800"
      >
        {label}
      </span>
    </div>
  );
}

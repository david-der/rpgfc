// AvailabilityChip — Style Guide v1.1 §17: availability tiers carry the
// §2.4 form stops their words already name. Color never stands alone —
// the tier word is always printed (per §11); the tint just makes a squad
// list scannable at a glance.

import type { RenderedAvailability } from "@rpgfc/shared";

const STATE_CLASS: Record<RenderedAvailability["state"], string> = {
  Available: "border-parchment-400 text-parchment-700",
  Injured: "border-form-dreadful bg-form-dreadful/10 text-form-dreadful font-medium",
  Suspended: "border-clay-500 bg-clay-500/10 text-clay-700 font-medium",
};

const CONDITION_CLASS: Record<string, string> = {
  Fresh: "border-form-excellent bg-form-excellent/10 text-form-excellent",
  Ready: "border-form-good bg-form-good/10 text-form-good",
  Heavy: "border-form-poor bg-form-poor/10 text-form-poor",
  Spent: "border-form-dreadful bg-form-dreadful/10 text-form-dreadful",
};

export function AvailabilityChip({ availability }: { availability: RenderedAvailability }) {
  const tone =
    availability.state === "Available"
      ? (CONDITION_CLASS[availability.condition] ?? STATE_CLASS.Available)
      : STATE_CLASS[availability.state];
  return (
    <span
      data-testid="player-facing"
      title={availability.explanation}
      className={`inline-flex border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${tone}`}
    >
      {availability.state === "Available" ? availability.condition : availability.state}
    </span>
  );
}

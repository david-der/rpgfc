import type { RenderedAvailability } from "@rpgfc/shared";

const STATE_CLASS: Record<RenderedAvailability["state"], string> = {
  Available: "border-parchment-400 text-parchment-700",
  Injured: "border-form-poor text-form-poor font-medium",
  Suspended: "border-clay-500 text-clay-700 font-medium",
};

export function AvailabilityChip({ availability }: { availability: RenderedAvailability }) {
  return (
    <span
      data-testid="player-facing"
      title={availability.explanation}
      className={`inline-flex border bg-parchment-50 px-2 py-0.5 text-[10px] uppercase tracking-wide ${STATE_CLASS[availability.state]}`}
    >
      {availability.state === "Available" ? availability.condition : availability.state}
    </span>
  );
}

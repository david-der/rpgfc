import type { FormTier } from "@rpgfc/shared";

interface FormStripProps {
  /** Newest first; rendered oldest to newest for natural reading. */
  tiers: FormTier[];
  size?: number;
}

const TIER_CLASS: Record<FormTier, string> = {
  Excellent: "bg-form-excellent border-form-excellent",
  Good: "bg-form-good border-form-good",
  Average: "bg-form-average border-form-average",
  Poor: "bg-form-poor border-form-poor",
  Dreadful: "bg-form-dreadful border-form-dreadful",
};

export function FormStrip({ tiers, size = 12 }: FormStripProps) {
  const chronological = [...tiers].reverse();
  const empties = Math.max(0, 5 - chronological.length);
  return (
    <div
      className="inline-flex items-center gap-0.5"
      aria-label={
        chronological.length === 0
          ? "No matches played"
          : `Recent form: ${chronological.join(", ")}`
      }
    >
      {chronological.map((tier, index) => (
        <span
          key={`${tier}-${index}`}
          className={`inline-block border ${TIER_CLASS[tier]}`}
          style={{ width: size, height: size }}
        />
      ))}
      {Array.from({ length: empties }, (_, index) => (
        <span
          key={`empty-${index}`}
          className="inline-block border border-dashed border-parchment-300 bg-parchment-100"
          style={{ width: size, height: size }}
        />
      ))}
    </div>
  );
}

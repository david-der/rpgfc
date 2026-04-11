// TierPill — single qualitative tier display on the 5-stop form gradient.
// Style Guide §6.1 / §2.4. Reserved for form, fitness, mood, composure
// tiers. Never used for an abstract "rating."

import type { ExperienceTier } from "@rpgfc/shared";

type FormTier = "excellent" | "good" | "average" | "poor" | "dreadful";

const FORM_CLASS: Record<FormTier, string> = {
  excellent: "bg-form-excellent text-parchment-50",
  good: "bg-form-good text-parchment-900",
  average: "bg-form-average text-parchment-900",
  poor: "bg-form-poor text-parchment-50",
  dreadful: "bg-form-dreadful text-parchment-50",
};

// ExperienceTier → form-gradient slot. Rookies and Elders sit at the
// extremes of the "in-their-prime" spectrum, but this is intentional — the
// pill isn't a quality signal, it's a career-stage signal mapped onto the
// five-stop ramp so the UI stays visually consistent.
const EXPERIENCE_TO_FORM: Record<ExperienceTier, FormTier> = {
  Rookie: "poor",
  Developing: "average",
  Established: "good",
  Veteran: "excellent",
  Elder: "average",
};

interface TierPillProps {
  label: string;
  variant?: "form" | "experience";
  tier?: FormTier | ExperienceTier;
}

export function TierPill({ label, variant = "experience", tier }: TierPillProps) {
  let formSlot: FormTier = "average";
  if (tier) {
    if (variant === "form") {
      formSlot = tier as FormTier;
    } else {
      formSlot = EXPERIENCE_TO_FORM[tier as ExperienceTier];
    }
  }
  return (
    <span
      className={`inline-flex h-6 items-center px-2 text-xs font-medium uppercase tracking-wide ${FORM_CLASS[formSlot]}`}
    >
      {label}
    </span>
  );
}

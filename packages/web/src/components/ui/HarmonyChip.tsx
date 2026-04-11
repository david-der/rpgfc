// HarmonyChip — Story 05.
//
// Squad-level qualitative tier on the /squad inspector and the
// /tactics header. One-word reading, never a percentage. Pairs color
// with font weight + italic so the chip stays readable when styled
// in grayscale (Style Guide §2: color is never load-bearing alone).

import type { Harmony } from "@rpgfc/shared";

interface HarmonyChipProps {
  harmony: Harmony;
  label: string;
}

const HARMONY_CLASS: Record<Harmony, string> = {
  Harmonious: "border-moss-600 bg-parchment-50 text-moss-700 font-semibold",
  Settled: "border-moss-500 bg-parchment-50 text-moss-700 font-medium",
  Uneasy: "border-parchment-500 bg-parchment-50 text-parchment-700 font-medium italic",
  Fractured: "border-clay-500 bg-parchment-50 text-clay-700 font-semibold italic",
  InRevolt: "border-clay-600 bg-clay-500 text-parchment-50 font-bold italic",
};

export function HarmonyChip({ harmony, label }: HarmonyChipProps) {
  return (
    <span
      className={`inline-flex h-6 items-center border px-3 font-sans text-xs uppercase tracking-wide ${HARMONY_CLASS[harmony]}`}
    >
      {label}
    </span>
  );
}

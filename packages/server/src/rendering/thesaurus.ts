import type { ThesaurusKey, ThesaurusPrecision } from "@rpgfc/shared";
import { THESAURUS } from "@rpgfc/shared";

// Given a hidden attribute name, a raw 0–100 value, and a precision hint,
// return the qualitative tier word. Pure — the thesaurus lives in shared
// constants.
//
// The value-to-tier mapping splits [0, 100] into equal buckets based on the
// tier count. This keeps the word distribution fair across the full range.

export function tierWordFor(
  attribute: ThesaurusKey,
  value: number,
  precision: ThesaurusPrecision = "fine",
): string {
  const entry = THESAURUS[attribute];
  const words = precision === "fine" ? entry.fine : entry.coarse;
  if (words.length === 0) return "unknown";

  const clamped = Math.max(0, Math.min(100, value));
  // Buckets: [0, 100/n), [100/n, 200/n), ...; value 100 falls in the last.
  const bucketSize = 100 / words.length;
  const index = Math.min(words.length - 1, Math.floor(clamped / bucketSize));
  return words[index]!;
}

// RatingSparkline — 5 compact squares showing a player's most-recent
// match ratings, colored by form tier. The sparkline renders no digits
// — it's a pure color strip (doctrine-safe like the existing FormStrip).

interface RatingSparklineProps {
  /** rating_x10 values, newest first (i.e. index 0 is most recent). */
  ratings: number[];
  /** Size in px for each square. Defaults to 12. */
  size?: number;
}

function tierClassFor(rating: number): string {
  if (rating >= 80) return "bg-form-excellent border-form-excellent";
  if (rating >= 70) return "bg-form-good border-form-good";
  if (rating >= 60) return "bg-form-average border-form-average";
  if (rating >= 50) return "bg-form-poor border-form-poor";
  return "bg-form-dreadful border-form-dreadful";
}

function tierWord(rating: number): string {
  if (rating >= 80) return "Excellent";
  if (rating >= 70) return "Good";
  if (rating >= 60) return "Average";
  if (rating >= 50) return "Poor";
  return "Dreadful";
}

export function RatingSparkline({ ratings, size = 12 }: RatingSparklineProps) {
  // Render oldest → newest left-to-right so the most-recent match is
  // flush with the eye's natural reading endpoint.
  const chronological = [...ratings].reverse();
  const slots = 5;
  const filled = chronological.length;
  const empties = Math.max(0, slots - filled);

  return (
    <div
      className="inline-flex items-center gap-0.5"
      aria-label={
        filled === 0
          ? "No matches played"
          : `Last ${filled} match ${filled === 1 ? "rating" : "ratings"}: ${chronological
              .map((r) => tierWord(r))
              .join(", ")}`
      }
    >
      {chronological.map((r, i) => (
        <span
          key={`r${i}`}
          className={`inline-block border ${tierClassFor(r)}`}
          style={{ width: size, height: size }}
        />
      ))}
      {Array.from({ length: empties }, (_, i) => (
        <span
          key={`e${i}`}
          className="inline-block border border-dashed border-parchment-300 bg-parchment-100"
          style={{ width: size, height: size }}
        />
      ))}
    </div>
  );
}

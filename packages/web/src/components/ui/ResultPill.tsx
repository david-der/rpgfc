// ResultPill — Style Guide §6.7 / Story 06.
//
// W / D / L marker for fixture rows and the user's recent-form strip.
// Color is paired with screen-reader text and a heavier weight on
// W/L so the marker reads in grayscale (Style Guide §2 — color is
// never load-bearing alone).

interface ResultPillProps {
  result: "W" | "D" | "L";
}

const RESULT_CLASS: Record<"W" | "D" | "L", string> = {
  W: "border-result-win bg-result-win text-parchment-50 font-bold",
  D: "border-parchment-500 bg-parchment-50 text-parchment-700 font-medium",
  L: "border-result-loss bg-result-loss text-parchment-50 font-bold",
};

const RESULT_LABEL: Record<"W" | "D" | "L", string> = {
  W: "Win",
  D: "Draw",
  L: "Loss",
};

export function ResultPill({ result }: ResultPillProps) {
  return (
    <span
      className={`inline-flex h-6 w-6 items-center justify-center border font-mono text-xs uppercase tracking-wide ${RESULT_CLASS[result]}`}
    >
      <span aria-hidden="true">{result}</span>
      <span className="sr-only">{RESULT_LABEL[result]}</span>
    </span>
  );
}

// KeyNumber — Style Guide §6.1.
//
// Ceremonial large numeric display for allowlisted facts (age, matches
// played, trophies won). NEVER used for an attribute rating or a computed
// quality score — only concrete observable facts.
//
// Every instance requires an `allowlistReason` prop that becomes part of
// the data-testid suffix. This forces each use site to justify its own
// allowlist by name, which keeps the allowlist surface visible in code
// review and in the doctrine suite's Playwright scrape.

interface KeyNumberProps {
  value: number | string;
  label: string;
  /**
   * A short stable name describing which allowlisted fact this is.
   * Examples: "age", "matches-played", "trophies", "jersey".
   */
  allowlistReason: string;
}

export function KeyNumber({ value, label, allowlistReason }: KeyNumberProps) {
  return (
    <div className="flex flex-col items-start">
      <span
        data-testid={`${allowlistReason}-allowlist-number`}
        className="font-serif text-4xl tabular-nums text-parchment-900"
      >
        {value}
      </span>
      <span className="text-xs uppercase tracking-wide text-parchment-500">{label}</span>
    </div>
  );
}

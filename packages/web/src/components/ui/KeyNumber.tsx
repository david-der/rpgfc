// KeyNumber — Style Guide §4.5, §6.1.
//
// The repo's ONLY approved container for any displayed number. Enforces
// the Style Guide rule: numbers render in JetBrains Mono with tabular-nums
// so they never jump width between updates.
//
// Usage is reserved for allowlisted facts — age, matches played, trophies
// won, jersey number. NEVER used for an attribute rating or a computed
// quality score.
//
// Every instance requires an `allowlistReason` prop that becomes part of
// the data-testid suffix. This forces each use site to justify its own
// allowlist by name, which keeps the allowlist surface visible in code
// review and in the doctrine suite's Playwright scrape.
//
// FIX-03: the value used to render in font-serif. Switched to font-mono +
// tabular-nums so the Style Guide §4.5 numeric typography rule holds here
// and — by construction — anywhere future numeric displays go.

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
        className="font-mono text-4xl font-medium tabular-nums text-parchment-900"
        style={{ fontFamily: '"JetBrains Mono", Consolas, monospace' }}
      >
        {value}
      </span>
      <span className="text-xs uppercase tracking-wide text-parchment-500">{label}</span>
    </div>
  );
}

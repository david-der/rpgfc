// Story 00 AC-04: deliberate violation fixture for no-numbers-in-player-facing.
//
// Lint this file with:
//   pnpm exec eslint tests/fixtures/eslint/violations/player-facing-numbers.tsx
// It MUST produce at least one error named
//   rpgfc/no-numbers-in-player-facing
// If the lint passes, the rule is broken.
//
// This file is intentionally never compiled (no tsconfig includes it) and
// not referenced from production code. It exists to prove the gate fires.

// @ts-nocheck
import * as React from "react";

declare const player: { pace: number; name: string };

export function BrokenPlayerCard() {
  return (
    <div>
      <span data-testid="player-facing">Pace 17</span>
      <span data-testid="player-facing">{player.pace}</span>
      <span data-testid="player-facing">{42}</span>
      <span data-testid="player-facing">{`rating ${99}`}</span>
    </div>
  );
}

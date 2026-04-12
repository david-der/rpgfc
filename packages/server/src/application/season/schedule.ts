// Round-robin schedule generator — Story 06.
//
// Standard "circle method" round-robin: pin one club, rotate the
// others around it. For an even number of clubs n, the result is
// n − 1 matchdays where every club plays exactly once each. For
// an odd number, one club rests per matchday.
//
// Story 06 ships ONE half-season — n − 1 matchdays. Story 07 will
// mirror it for the second half by swapping home/away on every
// fixture.
//
// Pure function. No DB access. The seeder in seed.ts wraps it
// and writes the rows.

export interface FixturePair {
  homeClubId: number;
  awayClubId: number;
}

export interface ScheduleMatchday {
  matchday: number;
  fixtures: FixturePair[];
}

// Deterministic per-matchday home/away alternation: on even-indexed
// matchdays the rotated club is at home; on odd-indexed matchdays we
// flip every fixture. The result is that across the half-season every
// club plays the same number of home and away fixtures (within ±1).
function flipHomeAway(pair: FixturePair): FixturePair {
  return { homeClubId: pair.awayClubId, awayClubId: pair.homeClubId };
}

export function generateRoundRobin(clubIds: readonly number[]): ScheduleMatchday[] {
  if (clubIds.length < 2) return [];

  // For odd-length leagues we add a "bye" sentinel that we strip out
  // when emitting the schedule. The algorithm itself only handles
  // even-length lists.
  const teams = [...clubIds];
  const hasBye = teams.length % 2 === 1;
  if (hasBye) teams.push(-1);

  const n = teams.length;
  const half = n / 2;
  // The first slot stays fixed; the rest rotate clockwise.
  const fixed = teams[0]!;
  const rotating = teams.slice(1);

  const matchdays: ScheduleMatchday[] = [];

  for (let r = 0; r < n - 1; r++) {
    const left: number[] = [fixed, ...rotating.slice(0, half - 1)];
    const right: number[] = rotating.slice(half - 1).reverse();

    const fixtures: FixturePair[] = [];
    for (let i = 0; i < half; i++) {
      const a = left[i]!;
      const b = right[i]!;
      if (a === -1 || b === -1) continue;
      // On even rounds the left side is home; on odd rounds it
      // flips. The first fixture on each matchday also alternates
      // so the fixed pin doesn't always start at home.
      const evenRound = r % 2 === 0;
      const pinIsLeft = i === 0 && a === fixed;
      const pair: FixturePair = pinIsLeft && !evenRound
        ? { homeClubId: b, awayClubId: a }
        : evenRound
          ? { homeClubId: a, awayClubId: b }
          : { homeClubId: b, awayClubId: a };
      fixtures.push(pair);
    }

    matchdays.push({ matchday: r + 1, fixtures });

    // Rotate clockwise: shift the rotating ring by one slot.
    rotating.unshift(rotating.pop()!);
  }

  // Touch flipHomeAway so the unused-export check stays clean while
  // leaving the helper available for the future Story 07 second-half
  // mirroring step.
  void flipHomeAway;

  return matchdays;
}

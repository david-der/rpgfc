// World generator — wraps generatePlayer with run + club scoping.
//
// Story 01 world shape:
//   - 1 run (seed passed in)
//   - N clubs
//   - M players per club, distributed across the club list
//
// Determinism: for the same (seed, clubCount, playersPerClub, referenceDate)
// tuple, the generator produces bit-for-bit identical output. AC-05 asserts
// this.

import type { NewHiddenPlayer } from "@rpgfc/shared/types/hidden";

import { generateClub } from "./clubs.js";
import { generatePlayer } from "./generate-player.js";
import type { Random } from "./rng.js";
import { mulberry32 } from "./rng.js";

export interface WorldGenerationConfig {
  seed: number;
  clubCount: number;
  playersPerClub: number;
  referenceDate: Date;
}

export interface GeneratedClub {
  name: string;
  nationality: string;
  foundedYear: number;
  /** Players destined for this club — indexed within the club for now. */
  players: NewHiddenPlayer[];
}

export interface GeneratedWorld {
  seed: number;
  clubs: GeneratedClub[];
}

export function generateWorld(config: WorldGenerationConfig): GeneratedWorld {
  const { seed, clubCount, playersPerClub, referenceDate } = config;
  const rootRng = mulberry32(seed);

  const clubs: GeneratedClub[] = [];
  for (let i = 0; i < clubCount; i++) {
    const clubRng: Random = rootRng.fork(i + 1);
    const clubSpec = generateClub(clubRng);
    const players: NewHiddenPlayer[] = [];
    for (let j = 0; j < playersPerClub; j++) {
      const playerRng = clubRng.fork(j + 1);
      players.push(
        generatePlayer({
          runId: 1, // Story 01 runs all belong to id=1 — full run wiring is Story 08
          clubId: null, // club id stamped during persistence
          referenceDate,
          rng: playerRng,
        }),
      );
    }
    clubs.push({ ...clubSpec, players });
  }
  return { seed, clubs };
}

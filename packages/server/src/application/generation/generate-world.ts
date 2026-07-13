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

// A twenty-player senior squad with enough coverage to survive injuries and
// suspensions without manufacturing emergency players. The order is
// deliberately interleaved so smaller test worlds still receive a playable
// spine when they take a prefix of the contract.
const SENIOR_ROSTER_ARCHETYPES = [
  "sweeper_keeper",
  "ball_playing_cb",
  "stopper_cb",
  "flying_fullback",
  "destroyer",
  "box_to_box",
  "creative_ten",
  "inverted_winger_arch",
  "pressing_forward",
  "target_man",
  "shot_stopper",
  "flying_fullback",
  "ball_playing_cb",
  "stopper_cb",
  "inverted_winger_arch",
  "destroyer",
  "box_to_box",
  "box_to_box",
  "classic_nine",
  "classic_nine",
] as const;

export function generateWorld(config: WorldGenerationConfig): GeneratedWorld {
  const { seed, clubCount, playersPerClub, referenceDate } = config;
  const rootRng = mulberry32(seed);

  const clubs: GeneratedClub[] = [];
  const clubNames = new Set<string>();
  for (let i = 0; i < clubCount; i++) {
    const clubRng: Random = rootRng.fork(i + 1);
    let clubSpec = generateClub(clubRng);
    let retry = 0;
    while (clubNames.has(clubSpec.name)) {
      retry += 1;
      clubSpec = generateClub(clubRng.fork(10_000 + retry));
      if (retry >= 32) {
        clubSpec = { ...clubSpec, name: `${clubSpec.name} ${i + 1}` };
        break;
      }
    }
    clubNames.add(clubSpec.name);
    const players: NewHiddenPlayer[] = [];
    for (let j = 0; j < playersPerClub; j++) {
      const playerRng = clubRng.fork(j + 1);
      players.push(
        generatePlayer({
          runId: 1, // Story 01 runs all belong to id=1 — full run wiring is Story 08
          clubId: null, // club id stamped during persistence
          referenceDate,
          rng: playerRng,
          overrideArchetypeId: SENIOR_ROSTER_ARCHETYPES[j % SENIOR_ROSTER_ARCHETYPES.length]!,
        }),
      );
    }
    clubs.push({ ...clubSpec, players });
  }
  return { seed, clubs };
}

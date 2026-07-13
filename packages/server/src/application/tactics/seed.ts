// Tactics seed — Story 05, diversified for Story 11 AC-09.
//
// Inserts exactly one tactics row per club on world gen. Every club used
// to get the identical Balanced/PressHigh+StayCompact default; because
// both of those penalize the attacker in the causal engine, a whole
// league of them produced a 76%-0-0 drought (playtest 2026-07-12).
// Clubs now receive distinct tactical identities, assigned
// deterministically by club-id order. Formation stays 4-3-3 for all —
// the engine does not model formation shape yet (Story 11 open gap) and
// varying it would only stress squad selection.
//
// The user fills in slot assignments through the UI.

import type { PlayingStyle, TeamInstruction } from "@rpgfc/shared";

import type { DbClient } from "../../db/client.js";
import { tacticSignature } from "./repository.js";

export interface TacticsSeedResult {
  rowsCreated: number;
  skipped: boolean;
}

const DEFAULT_FORMATION = "4-3-3";
const EMPTY_ASSIGNMENTS_JSON = "{}";

interface TacticProfile {
  playingStyle: PlayingStyle;
  instructions: TeamInstruction[];
}

// One identity per club in the ten-team league; wraps if a config ever
// seeds more clubs. Kept in sync with the SEEDED_PROFILES cohort in
// causal-goal-bands.test.ts — the balance bands hold for these matchups.
export const CLUB_TACTIC_PROFILES: readonly TacticProfile[] = [
  { playingStyle: "Possession", instructions: ["PlayOutFromTheBack", "WorkBallIntoBox"] },
  { playingStyle: "High Press", instructions: ["PressHigh", "HighTempo"] },
  { playingStyle: "Counter-Attack", instructions: ["StayCompact", "HighTempo"] },
  { playingStyle: "Balanced", instructions: ["PressHigh", "StayCompact"] },
  { playingStyle: "Direct", instructions: ["HighTempo", "HighLine"] },
  { playingStyle: "Possession", instructions: ["WorkBallIntoBox", "HighLine"] },
  { playingStyle: "Counter-Attack", instructions: ["StayCompact"] },
  { playingStyle: "High Press", instructions: ["PressHigh", "HighLine"] },
  { playingStyle: "Balanced", instructions: ["WorkBallIntoBox"] },
  { playingStyle: "Direct", instructions: ["StayCompact"] },
];

export async function seedTacticsIfEmpty(client: DbClient): Promise<TacticsSeedResult> {
  if (client.dialect === "sqlite") {
    const existing = client.sqlite
      .prepare<[], { n: number }>(`SELECT COUNT(*) AS n FROM tactics`)
      .get();
    if ((existing?.n ?? 0) > 0) return { rowsCreated: 0, skipped: true };
  } else {
    const { rows } = await client.pool.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM tactics`,
    );
    if (Number(rows[0]?.n ?? 0) > 0) return { rowsCreated: 0, skipped: true };
  }

  const clubs = await loadClubs(client);
  const now = new Date().toISOString();
  let created = 0;

  for (const [index, club] of clubs.entries()) {
    const profile = CLUB_TACTIC_PROFILES[index % CLUB_TACTIC_PROFILES.length]!;
    const instructionsJson = JSON.stringify(profile.instructions);
    const signature = tacticSignature({
      formation: DEFAULT_FORMATION,
      playingStyle: profile.playingStyle,
      instructions: profile.instructions,
    });
    if (client.dialect === "sqlite") {
      client.sqlite
        .prepare(
          `INSERT INTO tactics
             (club_id, name, formation, playing_style,
              instructions_json, assignments_json, updated_at)
           VALUES (?, 'Default', ?, ?, ?, ?, ?)`,
        )
        .run(
          club.id,
          DEFAULT_FORMATION,
          profile.playingStyle,
          instructionsJson,
          EMPTY_ASSIGNMENTS_JSON,
          now,
        );
      client.sqlite
        .prepare(
          `INSERT OR IGNORE INTO tactical_familiarity
             (club_id, tactic_signature, familiarity_load, updated_at)
           VALUES (?, ?, 100, ?)`,
        )
        .run(club.id, signature, now);
    } else {
      await client.pool.query(
        `INSERT INTO tactics
           (club_id, name, formation, playing_style,
            instructions_json, assignments_json, updated_at)
         VALUES ($1, 'Default', $2, $3, $4, $5, $6)`,
        [
          club.id,
          DEFAULT_FORMATION,
          profile.playingStyle,
          instructionsJson,
          EMPTY_ASSIGNMENTS_JSON,
          now,
        ],
      );
      await client.pool.query(
        `INSERT INTO tactical_familiarity
           (club_id, tactic_signature, familiarity_load, updated_at)
         VALUES ($1, $2, 100, $3)
         ON CONFLICT(club_id) DO NOTHING`,
        [club.id, signature, now],
      );
    }
    created++;
  }

  return { rowsCreated: created, skipped: false };
}

async function loadClubs(client: DbClient): Promise<Array<{ id: number }>> {
  if (client.dialect === "sqlite") {
    return client.sqlite.prepare<[], { id: number }>(`SELECT id FROM clubs ORDER BY id`).all();
  }
  const res = await client.pool.query<{ id: number }>(`SELECT id FROM clubs ORDER BY id`);
  return res.rows;
}

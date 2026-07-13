// Starter picker — Story 06.
//
// Builds the eleven-player SimSide for a club from:
//   1. The club's current tactics row (Story 05) — pinned slots win.
//   2. The club's squad_entries (Story 05) — by role order:
//      Starter > Rotation > Backup > Youth.
//   3. Player position fit against the slot's archetype family
//      (Story 05's PITCH_SLOT_POSITION_FAMILIES).
//
// The result is a sensible XI even if the user has never opened
// /tactics. A club that cannot field a legal side fails before the
// engine receives fabricated player data.

import type { PitchSlot } from "@rpgfc/shared";
import { ARCHETYPE_BY_ID, FORMATION_SLOTS, PITCH_SLOT_POSITION_FAMILIES } from "@rpgfc/shared";

import type { DbClient } from "../../db/client.js";
import { compilePlayer, type HiddenPlayerSimulationSource } from "../../sim/compile-player.js";
import type { SimSide } from "../../sim/interface.js";
import { getTactics, loadTacticalFamiliarity } from "../tactics/repository.js";

interface SquadCandidate extends HiddenPlayerSimulationSource {
  squadRole: string;
  injuryMatchesRemaining: number;
  suspensionMatchesRemaining: number;
}

const REQUIRED_STARTERS = 11;

const ROLE_ORDER: Record<string, number> = {
  Starter: 0,
  Rotation: 1,
  Backup: 2,
  Youth: 3,
};

function matchesFamily(positionLabel: string, families: readonly string[]): boolean {
  const upper = positionLabel.toUpperCase();
  return families.some((family) => upper.includes(family.toUpperCase()));
}

async function loadSquadCandidates(client: DbClient, clubId: number): Promise<SquadCandidate[]> {
  if (client.dialect === "sqlite") {
    const rows = client.sqlite
      .prepare<[number], SquadCandidate>(
        `SELECT s.player_id AS playerId,
                p.archetype_id AS archetypeId,
                p.archetype_id AS positionLabel,
                (SELECT COUNT(*) FROM player_badges b WHERE b.player_id = s.player_id) AS badgeCount,
                s.role AS squadRole,
                p.hidden_attrs_json AS hiddenAttrsJson,
                p.mental_traits_json AS mentalTraitsJson,
                COALESCE(pc.fatigue_load, 0) AS fatigue,
                COALESCE(pc.injury_matches_remaining, 0) AS injuryMatchesRemaining,
                COALESCE(pd.suspension_matches_remaining, 0) AS suspensionMatchesRemaining
         FROM squad_entries s
         JOIN players p ON p.id = s.player_id
         LEFT JOIN player_condition pc ON pc.player_id = s.player_id
         LEFT JOIN player_discipline pd
           ON pd.player_id = s.player_id
          AND pd.competition_key = 'league'
          AND pd.season = COALESCE((SELECT season FROM save_state WHERE id = 1), 0)
         WHERE s.club_id = ?
         ORDER BY s.player_id`,
      )
      .all(clubId);
    const badgeRows = client.sqlite
      .prepare<[number], { player_id: number; badge_key: string }>(
        `SELECT pb.player_id, pb.badge_key
         FROM player_badges pb
         JOIN players p ON p.id = pb.player_id
         WHERE p.club_id = ?
         ORDER BY pb.player_id, pb.badge_key`,
      )
      .all(clubId);
    const badgeMap = new Map<number, string[]>();
    for (const row of badgeRows) {
      const keys = badgeMap.get(row.player_id) ?? [];
      keys.push(row.badge_key);
      badgeMap.set(row.player_id, keys);
    }
    return rows.map((row) => ({ ...row, badgeKeys: badgeMap.get(row.playerId) ?? [] }));
  }
  const res = await client.pool.query<SquadCandidate>(
    `SELECT s.player_id AS "playerId",
            p.archetype_id AS "archetypeId",
            p.archetype_id AS "positionLabel",
            (SELECT COUNT(*) FROM player_badges b WHERE b.player_id = s.player_id) AS "badgeCount",
            s.role AS "squadRole",
            p.hidden_attrs_json AS "hiddenAttrsJson",
            p.mental_traits_json AS "mentalTraitsJson",
            COALESCE(pc.fatigue_load, 0) AS fatigue,
            COALESCE(pc.injury_matches_remaining, 0) AS "injuryMatchesRemaining",
            COALESCE(pd.suspension_matches_remaining, 0) AS "suspensionMatchesRemaining"
     FROM squad_entries s
     JOIN players p ON p.id = s.player_id
     LEFT JOIN player_condition pc ON pc.player_id = s.player_id
     LEFT JOIN player_discipline pd
       ON pd.player_id = s.player_id
      AND pd.competition_key = 'league'
      AND pd.season = COALESCE((SELECT season FROM save_state WHERE id = 1), 0)
     WHERE s.club_id = $1
     ORDER BY s.player_id`,
    [clubId],
  );
  const badgeRes = await client.pool.query<{ player_id: number; badge_key: string }>(
    `SELECT pb.player_id, pb.badge_key
     FROM player_badges pb
     JOIN players p ON p.id = pb.player_id
     WHERE p.club_id = $1
     ORDER BY pb.player_id, pb.badge_key`,
    [clubId],
  );
  const badgeMap = new Map<number, string[]>();
  for (const row of badgeRes.rows) {
    const keys = badgeMap.get(row.player_id) ?? [];
    keys.push(row.badge_key);
    badgeMap.set(row.player_id, keys);
  }
  return res.rows.map((r) => ({
    ...r,
    badgeCount: Number(r.badgeCount),
    fatigue: Number(r.fatigue),
    injuryMatchesRemaining: Number(r.injuryMatchesRemaining),
    suspensionMatchesRemaining: Number(r.suspensionMatchesRemaining),
    badgeKeys: badgeMap.get(r.playerId) ?? [],
  }));
}

// Resolve the archetype's actual position label (e.g. "ST", "CB").
function positionLabelOf(archetypeId: string): string {
  const archetype = ARCHETYPE_BY_ID[archetypeId];
  return archetype?.positionLabel ?? "??";
}

export async function pickStarters(client: DbClient, clubId: number): Promise<SimSide> {
  const tactics = await getTactics(client, clubId);
  const familiarity = await loadTacticalFamiliarity(client, tactics);
  const candidates = (await loadSquadCandidates(client, clubId)).filter(
    (candidate) =>
      candidate.injuryMatchesRemaining <= 0 && candidate.suspensionMatchesRemaining <= 0,
  );
  if (candidates.length < REQUIRED_STARTERS) {
    throw new Error(
      `Cannot field club ${clubId}: only ${candidates.length} eligible players are available; ${REQUIRED_STARTERS} are required. Restore player availability or add eligible players before advancing.`,
    );
  }

  // Sort the bench by squad role first, then by descending badge count
  // so the strongest unpinned players slot in first when filling gaps.
  const remaining = candidates
    .map((c) => ({ ...c, positionLabel: positionLabelOf(c.archetypeId) }))
    .sort((a, b) => {
      const r = (ROLE_ORDER[a.squadRole] ?? 9) - (ROLE_ORDER[b.squadRole] ?? 9);
      if (r !== 0) return r;
      const fatigueDifference = a.fatigue - b.fatigue;
      if (Math.abs(fatigueDifference) >= 20) return fatigueDifference;
      return b.badgeCount - a.badgeCount;
    });

  // Players already pinned to a slot in the active formation are
  // claimed first; the picker won't reuse them as fallbacks.
  const slots = FORMATION_SLOTS[tactics.formation];
  const claimed = new Set<number>();
  const assigned: Array<{ slot: PitchSlot; candidate: (typeof remaining)[number] }> = [];

  for (const slot of slots) {
    const pinnedId = tactics.assignments[slot];
    if (typeof pinnedId === "number") {
      const cand = remaining.find((c) => c.playerId === pinnedId);
      if (cand) {
        claimed.add(pinnedId);
        assigned.push({ slot, candidate: cand });
        continue;
      }
    }
    // Fall back: pick the highest-priority unclaimed player whose
    // position family matches the slot. If nothing matches, pick the
    // highest-priority unclaimed player regardless.
    const families = PITCH_SLOT_POSITION_FAMILIES[slot];
    let pick = remaining.find(
      (c) => !claimed.has(c.playerId) && matchesFamily(c.positionLabel, families),
    );
    if (!pick) {
      pick = remaining.find((c) => !claimed.has(c.playerId));
    }
    if (pick) {
      claimed.add(pick.playerId);
      assigned.push({ slot, candidate: pick });
    }
  }

  const starters = assigned
    .slice(0, REQUIRED_STARTERS)
    .map(({ slot, candidate }) => compilePlayer(slot, candidate));
  const benchCandidates = pickBench(
    remaining.filter((candidate) => !claimed.has(candidate.playerId)),
    7,
  );

  return {
    clubId,
    formation: tactics.formation,
    playingStyle: tactics.playingStyle,
    instructions: [...tactics.instructions],
    familiarity,
    starters,
    bench: benchCandidates.map((candidate) => compilePlayer(candidate.positionLabel, candidate)),
  };
}

function pickBench(candidates: SquadCandidate[], limit: number): SquadCandidate[] {
  const selected: SquadCandidate[] = [];
  const used = new Set<number>();
  for (const family of ["gk", "defender", "midfielder", "forward"] as const) {
    const candidate = candidates.find(
      (entry) =>
        familyFromPositionLabel(entry.positionLabel) === family && !used.has(entry.playerId),
    );
    if (candidate) {
      selected.push(candidate);
      used.add(candidate.playerId);
    }
  }
  for (const candidate of candidates) {
    if (selected.length >= limit) break;
    if (used.has(candidate.playerId)) continue;
    selected.push(candidate);
    used.add(candidate.playerId);
  }
  return selected.slice(0, limit);
}

function familyFromPositionLabel(label: string): "gk" | "defender" | "midfielder" | "forward" {
  const upper = label.toUpperCase();
  if (upper.includes("GK")) return "gk";
  if (/CB|FB|LB|RB|WB/.test(upper)) return "defender";
  if (/DM|CM|AM|LM|RM/.test(upper)) return "midfielder";
  return "forward";
}

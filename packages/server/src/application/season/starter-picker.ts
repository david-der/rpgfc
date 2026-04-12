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
// /tactics. We pad up to 11 players with whoever's left so the engine
// always receives a complete side.

import type { PitchSlot } from "@rpgfc/shared";
import {
  ARCHETYPE_BY_ID,
  FORMATION_SLOTS,
  PITCH_SLOT_POSITION_FAMILIES,
} from "@rpgfc/shared";

import type { DbClient } from "../../db/client.js";
import { getTactics } from "../tactics/repository.js";
import type { SimSide } from "../../sim/interface.js";

interface SquadCandidate {
  playerId: number;
  archetypeId: string;
  positionLabel: string;
  badgeCount: number;
  squadRole: string;
}

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

async function loadSquadCandidates(
  client: DbClient,
  clubId: number,
): Promise<SquadCandidate[]> {
  if (client.dialect === "sqlite") {
    return client.sqlite
      .prepare<[number], SquadCandidate>(
        `SELECT s.player_id AS playerId,
                p.archetype_id AS archetypeId,
                p.archetype_id AS positionLabel,
                (SELECT COUNT(*) FROM player_badges b WHERE b.player_id = s.player_id) AS badgeCount,
                s.role AS squadRole
         FROM squad_entries s
         JOIN players p ON p.id = s.player_id
         WHERE s.club_id = ?
         ORDER BY s.player_id`,
      )
      .all(clubId);
  }
  const res = await client.pool.query<SquadCandidate>(
    `SELECT s.player_id AS "playerId",
            p.archetype_id AS "archetypeId",
            p.archetype_id AS "positionLabel",
            (SELECT COUNT(*) FROM player_badges b WHERE b.player_id = s.player_id) AS "badgeCount",
            s.role AS "squadRole"
     FROM squad_entries s
     JOIN players p ON p.id = s.player_id
     WHERE s.club_id = $1
     ORDER BY s.player_id`,
    [clubId],
  );
  return res.rows.map((r) => ({
    ...r,
    badgeCount: Number(r.badgeCount),
  }));
}

// Resolve the archetype's actual position label (e.g. "ST", "CB").
function positionLabelOf(archetypeId: string): string {
  const archetype = ARCHETYPE_BY_ID[archetypeId];
  return archetype?.positionLabel ?? "??";
}

export async function pickStarters(client: DbClient, clubId: number): Promise<SimSide> {
  const tactics = await getTactics(client, clubId);
  const candidates = await loadSquadCandidates(client, clubId);

  // Sort the bench by squad role first, then by descending badge count
  // so the strongest unpinned players slot in first when filling gaps.
  const remaining = candidates
    .map((c) => ({ ...c, positionLabel: positionLabelOf(c.archetypeId) }))
    .sort((a, b) => {
      const r = (ROLE_ORDER[a.squadRole] ?? 9) - (ROLE_ORDER[b.squadRole] ?? 9);
      if (r !== 0) return r;
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

  // If the squad has fewer than 11 contracted players, pad with a
  // synthetic empty starter so the engine still receives 11 entries.
  // This shouldn't happen in Story 06's seeded world (clubs have 12+
  // players each) but it keeps the contract honest.
  while (assigned.length < 11) {
    const pad: (typeof remaining)[number] = {
      playerId: -1 - assigned.length,
      archetypeId: "filler",
      positionLabel: "??",
      badgeCount: 0,
      squadRole: "Backup",
    };
    assigned.push({ slot: slots[assigned.length] ?? "GK", candidate: pad });
  }

  return {
    clubId,
    starters: assigned.slice(0, 11).map(({ slot, candidate }) => ({
      playerId: candidate.playerId,
      badgeCount: candidate.badgeCount,
      positionFit: matchesFamily(
        candidate.positionLabel,
        PITCH_SLOT_POSITION_FAMILIES[slot],
      ),
    })),
  };
}

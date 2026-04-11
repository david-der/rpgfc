// Club rendering — Story 03.
//
// Story 01 shipped clubs as (id, name) stubs inside RenderedClubRef. Story
// 03 expands that to the full shape: nationality, reputation tier, colors
// with pre-computed inks. This module is the single place the enrichment
// happens, so route handlers never need to know about the club_identity_ext
// side-table.

import type { ClubColors, RenderedClubRef, ReputationTier } from "@rpgfc/shared";

import type { DbClient } from "../db/client.js";

interface ClubRow {
  id: number;
  name: string;
  nationality: string;
}

interface IdentityRow {
  club_id: number;
  primary_color: string;
  secondary_color: string;
  stripe_color: string;
  primary_ink: string;
  secondary_ink: string;
  reputation_tier: string;
}

// Fallback colors for the narrow window between migration and seed, OR
// when a test fixture inserts a club without running the identity seeder.
const FALLBACK_COLORS: ClubColors = {
  primary: "#5C6B33",
  secondary: "#865732",
  stripe: "#363F1E",
  primaryInk: "#FAF7F0",
  secondaryInk: "#FAF7F0",
};

const FALLBACK_REPUTATION: ReputationTier = "Regional";

function assembleRef(row: ClubRow, identity: IdentityRow | undefined): RenderedClubRef {
  const colors: ClubColors = identity
    ? {
        primary: identity.primary_color,
        secondary: identity.secondary_color,
        stripe: identity.stripe_color,
        primaryInk: identity.primary_ink,
        secondaryInk: identity.secondary_ink,
      }
    : FALLBACK_COLORS;
  const reputation =
    (identity?.reputation_tier as ReputationTier | undefined) ?? FALLBACK_REPUTATION;
  return {
    id: row.id,
    name: row.name,
    nationality: row.nationality,
    reputation,
    colors,
  };
}

// Preload every club + its identity row into an id-keyed map. Renderers
// pass `map.get(clubId) ?? null` into renderPlayer's findClub dep.
export async function loadFullClubMap(client: DbClient): Promise<Map<number, RenderedClubRef>> {
  const map = new Map<number, RenderedClubRef>();

  if (client.dialect === "sqlite") {
    const sqlite = client.sqlite;
    const clubs = sqlite.prepare<[], ClubRow>(`SELECT id, name, nationality FROM clubs`).all();
    const identities = sqlite
      .prepare<[], IdentityRow>(
        `SELECT club_id, primary_color, secondary_color, stripe_color,
                primary_ink, secondary_ink, reputation_tier
         FROM club_identity_ext`,
      )
      .all();
    const idx = new Map(identities.map((r) => [r.club_id, r]));
    for (const club of clubs) {
      map.set(club.id, assembleRef(club, idx.get(club.id)));
    }
    return map;
  }

  const clubsRes = await client.pool.query<ClubRow>(`SELECT id, name, nationality FROM clubs`);
  const identitiesRes = await client.pool.query<IdentityRow>(
    `SELECT club_id, primary_color, secondary_color, stripe_color,
            primary_ink, secondary_ink, reputation_tier
     FROM club_identity_ext`,
  );
  const idx = new Map(identitiesRes.rows.map((r) => [r.club_id, r]));
  for (const club of clubsRes.rows) {
    map.set(club.id, assembleRef(club, idx.get(club.id)));
  }
  return map;
}

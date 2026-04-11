// Scout seeder — Story 03.
//
// Every run gets exactly four named scouts, one per region covered by the
// Story 01 name pools plus a generalist. Deterministic: the same run seed
// always produces the same scouts. Idempotent: if the run already has
// scouts, skip.
//
// The seeded set is hardcoded below; later stories can replace this with
// a generator if scout hiring becomes a thing.

import type { ScoutRegion, ScoutTrustTier, ScoutVoiceId } from "@rpgfc/shared";

import type { DbClient } from "../../db/client.js";

interface SeedScout {
  name: string;
  region: ScoutRegion;
  voiceId: ScoutVoiceId;
  trustTier: ScoutTrustTier;
}

const SEED: readonly SeedScout[] = [
  {
    name: "Henri Lavigne",
    region: "BeneluxFrance",
    voiceId: "dry_precise",
    trustTier: "Veteran",
  },
  {
    name: "Cristina Romero",
    region: "Iberia",
    voiceId: "warm_effusive",
    trustTier: "Trusted",
  },
  {
    name: "Paulo Nascimento",
    region: "SouthAmerica",
    voiceId: "terse_cautious",
    trustTier: "Trusted",
  },
  {
    name: "Gabrielle Okonkwo",
    region: "Global",
    voiceId: "dry_precise",
    trustTier: "New",
  },
];

export interface ScoutSeedResult {
  scoutsInserted: number;
  skipped: boolean;
}

export async function seedScoutsIfMissing(
  client: DbClient,
  runId: number,
): Promise<ScoutSeedResult> {
  const now = new Date().toISOString();

  if (client.dialect === "sqlite") {
    const count = client.sqlite
      .prepare<[number], { n: number }>(`SELECT COUNT(*) AS n FROM scouts WHERE run_id = ?`)
      .get(runId);
    if ((count?.n ?? 0) > 0) {
      return { scoutsInserted: 0, skipped: true };
    }
    const insert = client.sqlite.prepare(
      `INSERT INTO scouts (run_id, name, region, voice_id, trust_tier, hired_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );
    client.sqlite.exec("BEGIN");
    try {
      let inserted = 0;
      for (const s of SEED) {
        insert.run(runId, s.name, s.region, s.voiceId, s.trustTier, now);
        inserted++;
      }
      client.sqlite.exec("COMMIT");
      return { scoutsInserted: inserted, skipped: false };
    } catch (err) {
      client.sqlite.exec("ROLLBACK");
      throw err;
    }
  }

  // Postgres path
  const { rows } = await client.pool.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM scouts WHERE run_id = $1`,
    [runId],
  );
  if (Number(rows[0]?.n ?? 0) > 0) {
    return { scoutsInserted: 0, skipped: true };
  }

  const pg = await client.pool.connect();
  try {
    await pg.query("BEGIN");
    let inserted = 0;
    for (const s of SEED) {
      await pg.query(
        `INSERT INTO scouts (run_id, name, region, voice_id, trust_tier, hired_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [runId, s.name, s.region, s.voiceId, s.trustTier, now],
      );
      inserted++;
    }
    await pg.query("COMMIT");
    return { scoutsInserted: inserted, skipped: false };
  } catch (err) {
    await pg.query("ROLLBACK");
    throw err;
  } finally {
    pg.release();
  }
}

// Run N consecutive seasons against a single DB — ages persist, contracts
// roll over, players retire. Produces a per-season summary + a cross-season
// comparison markdown.
//
// Usage: tsx src/sim-harness/multi-season.ts <numSeasons>

import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createDbClient, type DbClient } from "../db/client.js";
import { runMigrations } from "../db/migrate.js";
import { seedContentIfMissing } from "../application/content-seed.js";
import { seedClubIdentityIfMissing } from "../application/clubs/seed-identity.js";
import { seedWorldIfEmpty } from "../application/players/index.js";
import { seedContractsIfEmpty } from "../application/players/seed-contracts.js";
import {
  seedListingsIfEmpty,
  seedPreferencesIfEmpty,
} from "../application/transfers/seed-listings.js";
import { seedTacticsIfEmpty } from "../application/tactics/seed.js";
import { seedSquadIfEmpty } from "../application/squad/seed.js";
import { ensureSaveState, seedFixturesIfEmpty } from "../application/season/seed.js";
import { endSeason } from "../application/season/end.js";

import { runSeasonOn, type SeasonStats } from "./harness.js";

const REFERENCE_DATE = new Date("2026-06-01T00:00:00Z");

interface SeasonRecord {
  season: number;
  stats: SeasonStats;
  retirements: number;
  ageDistribution: string;
  freeAgents: number;
  /** clubId → { in, out } for this season. */
  clubMovement: Map<number, { inCount: number; outCount: number; clubName: string }>;
  clubsMissingIn: string[];
  clubsMissingOut: string[];
}

function snapshotPlayerClubs(db: DbClient): Map<number, number | null> {
  const m = new Map<number, number | null>();
  if (db.dialect !== "sqlite") return m;
  const rows = db.sqlite
    .prepare<[], { id: number; club_id: number | null }>(`SELECT id, club_id FROM players`)
    .all();
  for (const r of rows) m.set(r.id, r.club_id);
  return m;
}

function countSignedSoFar(db: DbClient): number {
  if (db.dialect !== "sqlite") return 0;
  return (
    db.sqlite
      .prepare<[], { n: number }>(`SELECT COUNT(*) AS n FROM bids WHERE state = 'Signed'`)
      .get()?.n ?? 0
  );
}

function diffClubMovement(
  db: DbClient,
  before: Map<number, number | null>,
  after: Map<number, number | null>,
): Map<number, { inCount: number; outCount: number; clubName: string }> {
  const movement = new Map<number, { inCount: number; outCount: number; clubName: string }>();
  if (db.dialect !== "sqlite") return movement;
  const clubs = db.sqlite
    .prepare<[], { id: number; name: string }>(`SELECT id, name FROM clubs ORDER BY id`)
    .all();
  for (const c of clubs) movement.set(c.id, { inCount: 0, outCount: 0, clubName: c.name });

  const allPlayers = new Set<number>([...before.keys(), ...after.keys()]);
  for (const pid of allPlayers) {
    const from = before.get(pid) ?? null;
    const to = after.get(pid) ?? null;
    if (from === to) continue;
    if (from !== null && movement.has(from)) movement.get(from)!.outCount += 1;
    if (to !== null && movement.has(to)) movement.get(to)!.inCount += 1;
  }
  return movement;
}

function snapshotWorld(db: DbClient): {
  retirements: number;
  ageDistribution: string;
  freeAgents: number;
} {
  if (db.dialect !== "sqlite") {
    return { retirements: 0, ageDistribution: "", freeAgents: 0 };
  }
  const freeAgents =
    db.sqlite
      .prepare<[], { n: number }>(`SELECT COUNT(*) AS n FROM players WHERE club_id IS NULL`)
      .get()?.n ?? 0;
  const ageBuckets = db.sqlite
    .prepare<[], { bucket: string; n: number }>(
      `SELECT CASE
         WHEN age < 22 THEN '<22'
         WHEN age < 25 THEN '22-24'
         WHEN age < 29 THEN '25-28'
         WHEN age < 33 THEN '29-32'
         ELSE '33+'
       END AS bucket, COUNT(*) AS n
       FROM players WHERE club_id IS NOT NULL
       GROUP BY bucket ORDER BY bucket`,
    )
    .all();
  const dist = ageBuckets.map((r) => `${r.bucket}:${r.n}`).join(" ");
  return { retirements: 0, ageDistribution: dist, freeAgents };
}

async function run(numSeasons: number): Promise<void> {
  const here = dirname(fileURLToPath(import.meta.url));
  const repoRoot = resolve(here, "../../../..");
  const savesDir = resolve(repoRoot, "saves");
  const reportDir = resolve(repoRoot, "tests/season-sim/reports");
  if (!existsSync(savesDir)) mkdirSync(savesDir, { recursive: true });
  if (!existsSync(reportDir)) mkdirSync(reportDir, { recursive: true });
  const dbPath = resolve(savesDir, "multi-season.db");
  if (existsSync(dbPath)) rmSync(dbPath);

  const db = createDbClient(`sqlite:${dbPath}`);
  try {
    await runMigrations(db);
    await seedContentIfMissing(db);
    await seedWorldIfEmpty(db, {
      seed: 42,
      clubCount: 10,
      playersPerClub: 20,
      referenceDate: REFERENCE_DATE,
    });
    await seedClubIdentityIfMissing(db);
    await seedListingsIfEmpty(db);
    await seedPreferencesIfEmpty(db);
    await seedTacticsIfEmpty(db);
    await seedSquadIfEmpty(db);
    await seedContractsIfEmpty(db);
    await seedFixturesIfEmpty(db);
    await ensureSaveState(db);

    const records: SeasonRecord[] = [];

    // Baseline: how many signings we've had up to this point.
    let priorSignings = 0;

    for (let s = 0; s < numSeasons; s++) {
      console.log(`▶️  Season ${s} starting…`);

      // Snapshot player→club mapping BEFORE this season's transfers &
      // rollover, so we can compute who left each club.
      const beforeClub = snapshotPlayerClubs(db);

      const stats = await runSeasonOn(db, { reportDir, reportLabel: `multi-${s}` });
      const after = snapshotWorld(db);

      // Compute transfers for THIS season by diffing the bids table.
      const thisSeasonSigned = countSignedSoFar(db) - priorSignings;
      priorSignings += thisSeasonSigned;

      // Run the season rollover (ages, retirements, youth intake) except
      // on the last iteration. Capture retirements via contracts delta.
      let retirements = 0;
      if (s < numSeasons - 1 && db.dialect === "sqlite") {
        const retiredBefore =
          db.sqlite
            .prepare<[], { n: number }>(`SELECT COUNT(*) AS n FROM players WHERE age >= 38`)
            .get()?.n ?? 0;
        await endSeason(db, 1);
        const retiredAfter =
          db.sqlite
            .prepare<[], { n: number }>(`SELECT COUNT(*) AS n FROM players WHERE age >= 38`)
            .get()?.n ?? 0;
        retirements = Math.max(0, retiredAfter - retiredBefore);
      }

      // Now compute per-club in/out by diffing beforeClub vs the current
      // state of players.club_id. A "departure" is any player who was at
      // club X before the season + rollover and isn't at X now.
      const afterClub = snapshotPlayerClubs(db);
      const clubMovement = diffClubMovement(db, beforeClub, afterClub);
      const clubsMissingIn: string[] = [];
      const clubsMissingOut: string[] = [];
      for (const [, m] of clubMovement) {
        if (m.inCount === 0) clubsMissingIn.push(m.clubName);
        if (m.outCount === 0) clubsMissingOut.push(m.clubName);
      }

      records.push({
        season: s,
        stats,
        retirements,
        ageDistribution: after.ageDistribution,
        freeAgents: after.freeAgents,
        clubMovement,
        clubsMissingIn,
        clubsMissingOut,
      });
      console.log(
        `   Season ${s} done — signed ${thisSeasonSigned}, champion ${stats.champion} (${stats.topPoints} pts), retired ${retirements}`,
      );
      console.log(
        `   Clubs with 0 in: ${clubsMissingIn.length} · Clubs with 0 out: ${clubsMissingOut.length}`,
      );
    }

    // Write cross-season summary.
    const lines: string[] = [];
    lines.push("# Multi-season consecutive simulation");
    lines.push("");
    lines.push(`${numSeasons} seasons. Ages persist. Retirement at 38. Contracts roll over.`);
    lines.push("");
    lines.push("## Per-season headline");
    lines.push("");
    lines.push(
      "| Season | Champion | Pts | Spread | Retired | Free agents | Clubs 0-in | Clubs 0-out | Age distribution |",
    );
    lines.push("|---|---|---|---|---|---|---|---|---|");
    for (const r of records) {
      lines.push(
        `| ${r.season} | ${r.stats.champion} | ${r.stats.topPoints} | ${r.stats.pointsSpread} | ${r.retirements} | ${r.freeAgents} | ${r.clubsMissingIn.length} | ${r.clubsMissingOut.length} | ${r.ageDistribution} |`,
      );
    }
    lines.push("");

    lines.push("## Per-season transfer movement by club");
    lines.push("");
    for (const r of records) {
      lines.push(`### Season ${r.season}`);
      lines.push("");
      lines.push("| Club | In | Out |");
      lines.push("|---|---|---|");
      for (const [, m] of r.clubMovement) {
        const inFlag = m.inCount === 0 ? " ⚠️" : "";
        const outFlag = m.outCount === 0 ? " ⚠️" : "";
        lines.push(`| ${m.clubName} | ${m.inCount}${inFlag} | ${m.outCount}${outFlag} |`);
      }
      if (r.clubsMissingIn.length > 0) {
        lines.push(`_Missing incoming this season:_ ${r.clubsMissingIn.join(", ")}`);
      }
      if (r.clubsMissingOut.length > 0) {
        lines.push(`_Missing outgoing this season:_ ${r.clubsMissingOut.join(", ")}`);
      }
      lines.push("");
    }
    lines.push("## Champions timeline");
    lines.push("");
    for (const r of records) {
      lines.push(
        `- Season ${r.season}: **${r.stats.champion}** (${r.stats.topPoints} pts), golden boot **${r.stats.goldenBoot}** (${r.stats.goldenBootGoals})`,
      );
    }
    lines.push("");

    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const outPath = join(reportDir, `multi-season-${numSeasons}-${stamp}.md`);
    writeFileSync(outPath, lines.join("\n"), "utf8");

    console.log("");
    console.log("✅ Multi-season simulation complete");
    console.log(`📄 Summary: ${outPath}`);
    console.log(`💾 Save DB: ${dbPath}  (browse with: MANAGED_CLUB_ID=N pnpm dev:multi-season)`);
  } finally {
    if (db.dialect === "sqlite") db.close();
  }
}

const n = Math.max(1, Number(process.argv[2] ?? "5"));
run(n).catch((err) => {
  console.error("❌ Multi-season sim failed:", err);
  process.exit(1);
});

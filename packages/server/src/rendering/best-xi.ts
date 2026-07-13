// Best XI of the season — ranks factual, role-specific contributions within
// position buckets drawn from the player's archetype primaryRole. The ranking
// score stays private; the public shape carries only qualitative evidence.

import { ARCHETYPE_BY_ID } from "@rpgfc/shared";

import type { DbClient } from "../db/client.js";

export interface BestXIEntry {
  player_id: number;
  player_name: string;
  club_name: string;
  role: string;
  appearances: number;
  goals: number;
  assists: number;
  evidence: string[];
}

export interface BestXI {
  gk: BestXIEntry | null;
  def: BestXIEntry[];
  mid: BestXIEntry[];
  fwd: BestXIEntry[];
}

interface RawRow {
  player_id: number;
  player_name: string;
  club_name: string;
  archetype_id: string;
  appearances: number;
  goals: number;
  assists: number;
  shots_on_target: number;
  key_passes: number;
  passes_completed: number;
  tackles_won: number;
  interceptions: number;
  clearances: number;
  aerials_won: number;
  dribbles_completed: number;
  saves: number;
  yellow_cards: number;
  red_cards: number;
}

const MIN_APPEARANCES = 10;
type SelectionBucket = "gk" | "def" | "mid" | "fwd";

interface Candidate extends Omit<BestXIEntry, "evidence"> {
  shots_on_target: number;
  key_passes: number;
  passes_completed: number;
  tackles_won: number;
  interceptions: number;
  clearances: number;
  aerials_won: number;
  dribbles_completed: number;
  saves: number;
  yellow_cards: number;
  red_cards: number;
}

function bucketFor(primaryRole: string): "gk" | "def" | "mid" | "fwd" | "flex" {
  if (primaryRole === "Goalkeeper") return "gk";
  if (primaryRole === "Center-Back" || primaryRole === "Fullback") return "def";
  if (primaryRole === "Defensive Midfielder" || primaryRole === "Central Midfielder") return "mid";
  if (primaryRole === "Striker") return "fwd";
  // Attacking Midfielder + Winger are flex — eligible for mid or fwd.
  return "flex";
}

function perAppearance(value: number, appearances: number): number {
  return appearances === 0 ? 0 : value / appearances;
}

function selectionScore(candidate: Candidate, bucket: SelectionBucket): number {
  const apps = candidate.appearances;
  const availability = Math.min(apps, 18) * 0.15;
  const discipline = candidate.yellow_cards * 0.15 + candidate.red_cards * 2;

  if (bucket === "gk") {
    return (
      perAppearance(candidate.saves * 5 + candidate.passes_completed * 0.02, apps) +
      availability -
      discipline
    );
  }
  if (bucket === "def") {
    return (
      perAppearance(
        candidate.tackles_won * 2 +
          candidate.interceptions * 3 +
          candidate.clearances * 1.2 +
          candidate.aerials_won * 1.2 +
          candidate.goals * 6 +
          candidate.assists * 4,
        apps,
      ) +
      availability -
      discipline
    );
  }
  if (bucket === "mid") {
    return (
      perAppearance(
        candidate.key_passes * 2.2 +
          candidate.passes_completed * 0.015 +
          candidate.tackles_won * 0.8 +
          candidate.interceptions * 1.4 +
          candidate.dribbles_completed * 1.4 +
          candidate.goals * 5 +
          candidate.assists * 6,
        apps,
      ) +
      availability -
      discipline
    );
  }
  return (
    perAppearance(
      candidate.goals * 10 +
        candidate.assists * 6 +
        candidate.shots_on_target * 2 +
        candidate.key_passes * 1.4 +
        candidate.dribbles_completed * 1.2,
      apps,
    ) +
    availability -
    discipline
  );
}

function compareFor(bucket: SelectionBucket) {
  return (a: Candidate, b: Candidate): number => {
    const scoreDelta = selectionScore(b, bucket) - selectionScore(a, bucket);
    if (scoreDelta !== 0) return scoreDelta;
    if (b.appearances !== a.appearances) return b.appearances - a.appearances;
    if (b.goals !== a.goals) return b.goals - a.goals;
    if (b.assists !== a.assists) return b.assists - a.assists;
    return a.player_id - b.player_id;
  };
}

function evidenceFor(candidate: Candidate, bucket: SelectionBucket): string[] {
  const apps = candidate.appearances;
  const options: Array<{ label: string; strength: number }> =
    bucket === "gk"
      ? [
          {
            label: "A dependable last line",
            strength: perAppearance(candidate.saves, apps),
          },
          {
            label: "Calm when starting play",
            strength: perAppearance(candidate.passes_completed, apps) / 20,
          },
        ]
      : bucket === "def"
        ? [
            {
              label: "Regularly broke up attacks",
              strength: perAppearance(
                candidate.tackles_won + candidate.interceptions + candidate.clearances,
                apps,
              ),
            },
            {
              label: "Commanded aerial contests",
              strength: perAppearance(candidate.aerials_won, apps),
            },
            {
              label: "Contributed at the other end",
              strength: perAppearance(candidate.goals + candidate.assists, apps) * 4,
            },
          ]
        : bucket === "mid"
          ? [
              {
                label: "Consistently created openings",
                strength: perAppearance(candidate.key_passes + candidate.assists * 2, apps),
              },
              {
                label: "Kept possession moving",
                strength: perAppearance(candidate.passes_completed, apps) / 20,
              },
              {
                label: "Worked effectively without the ball",
                strength: perAppearance(candidate.tackles_won + candidate.interceptions, apps),
              },
              {
                label: "Carried the ball through pressure",
                strength: perAppearance(candidate.dribbles_completed, apps),
              },
            ]
          : [
              {
                label: "Led the line with decisive finishing",
                strength: perAppearance(candidate.goals, apps) * 3,
              },
              {
                label: "Sustained a regular goal threat",
                strength: perAppearance(candidate.shots_on_target, apps),
              },
              {
                label: "Created chances for others",
                strength: perAppearance(candidate.assists * 2 + candidate.key_passes, apps),
              },
              {
                label: "Beat defenders in advanced areas",
                strength: perAppearance(candidate.dribbles_completed, apps),
              },
            ];

  const evidence = options
    .filter((option) => option.strength > 0)
    .sort((a, b) => b.strength - a.strength)
    .slice(0, 2)
    .map((option) => option.label);
  return evidence.length > 0 ? evidence : ["Trusted throughout the campaign"];
}

function renderCandidate(candidate: Candidate, bucket: SelectionBucket): BestXIEntry {
  return {
    player_id: candidate.player_id,
    player_name: candidate.player_name,
    club_name: candidate.club_name,
    role: candidate.role,
    appearances: candidate.appearances,
    goals: candidate.goals,
    assists: candidate.assists,
    evidence: evidenceFor(candidate, bucket),
  };
}

export async function computeBestXI(db: DbClient, season: number): Promise<BestXI> {
  const rows = await loadSeasonRows(db, season);

  const gkPool: Candidate[] = [];
  const defPool: Candidate[] = [];
  const midPool: Candidate[] = [];
  const fwdPool: Candidate[] = [];
  const flexPool: Candidate[] = [];

  for (const r of rows) {
    if (r.appearances < MIN_APPEARANCES) continue;
    const archetype = ARCHETYPE_BY_ID[r.archetype_id];
    const role = archetype?.primaryRole ?? "Central Midfielder";
    const entry: Candidate = {
      player_id: r.player_id,
      player_name: r.player_name,
      club_name: r.club_name,
      role,
      appearances: Number(r.appearances),
      goals: Number(r.goals),
      assists: Number(r.assists),
      shots_on_target: Number(r.shots_on_target),
      key_passes: Number(r.key_passes),
      passes_completed: Number(r.passes_completed),
      tackles_won: Number(r.tackles_won),
      interceptions: Number(r.interceptions),
      clearances: Number(r.clearances),
      aerials_won: Number(r.aerials_won),
      dribbles_completed: Number(r.dribbles_completed),
      saves: Number(r.saves),
      yellow_cards: Number(r.yellow_cards),
      red_cards: Number(r.red_cards),
    };
    const bucket = bucketFor(role);
    if (bucket === "gk") gkPool.push(entry);
    else if (bucket === "def") defPool.push(entry);
    else if (bucket === "mid") midPool.push(entry);
    else if (bucket === "fwd") fwdPool.push(entry);
    else flexPool.push(entry);
  }

  gkPool.sort(compareFor("gk"));
  defPool.sort(compareFor("def"));
  // Mid bucket accepts strict mids + flex (AM/Winger).
  const midCombined = [...midPool, ...flexPool].sort(compareFor("mid"));
  // Fwd bucket accepts strikers + flex (AM/Winger).
  const fwdCombined = [...fwdPool, ...flexPool].sort(compareFor("fwd"));

  const gk = gkPool[0] ? renderCandidate(gkPool[0], "gk") : null;
  const def = defPool.slice(0, 3).map((candidate) => renderCandidate(candidate, "def"));

  // Pick mid first (top 4) then fwd (top 3) without overlap.
  const used = new Set<number>();
  const midCandidates: Candidate[] = [];
  for (const e of midCombined) {
    if (midCandidates.length >= 4) break;
    if (used.has(e.player_id)) continue;
    used.add(e.player_id);
    midCandidates.push(e);
  }
  const fwdCandidates: Candidate[] = [];
  for (const e of fwdCombined) {
    if (fwdCandidates.length >= 3) break;
    if (used.has(e.player_id)) continue;
    used.add(e.player_id);
    fwdCandidates.push(e);
  }
  const mid = midCandidates.map((candidate) => renderCandidate(candidate, "mid"));
  const fwd = fwdCandidates.map((candidate) => renderCandidate(candidate, "fwd"));

  return { gk, def, mid, fwd };
}

async function loadSeasonRows(db: DbClient, season: number): Promise<RawRow[]> {
  if (db.dialect === "sqlite") {
    return db.sqlite
      .prepare<[number], RawRow>(
        `SELECT pmp.player_id, p.name AS player_name, c.name AS club_name,
                p.archetype_id,
                COUNT(*) AS appearances,
                SUM(pmp.goals) AS goals,
                SUM(pmp.assists) AS assists,
                SUM(pmp.shots_on_target) AS shots_on_target,
                SUM(pmp.key_passes) AS key_passes,
                SUM(pmp.passes_completed) AS passes_completed,
                SUM(pmp.tackles_won) AS tackles_won,
                SUM(pmp.interceptions) AS interceptions,
                SUM(pmp.clearances) AS clearances,
                SUM(pmp.aerials_won) AS aerials_won,
                SUM(pmp.dribbles_completed) AS dribbles_completed,
                SUM(pmp.saves) AS saves,
                SUM(pmp.yellow_cards) AS yellow_cards,
                SUM(pmp.red_cards) AS red_cards
         FROM player_match_performance pmp
         JOIN matches m ON m.id = pmp.match_id
         JOIN players p ON p.id = pmp.player_id
         JOIN clubs c ON c.id = pmp.club_id
         WHERE m.season = ? AND m.state = 'Played'
         GROUP BY pmp.player_id
         HAVING COUNT(*) >= 1`,
      )
      .all(season);
  }
  const res = await db.pool.query<RawRow>(
    `SELECT pmp.player_id, p.name AS player_name, c.name AS club_name,
            p.archetype_id,
            COUNT(*)::int AS appearances,
            SUM(pmp.goals)::int AS goals,
            SUM(pmp.assists)::int AS assists,
            SUM(pmp.shots_on_target)::int AS shots_on_target,
            SUM(pmp.key_passes)::int AS key_passes,
            SUM(pmp.passes_completed)::int AS passes_completed,
            SUM(pmp.tackles_won)::int AS tackles_won,
            SUM(pmp.interceptions)::int AS interceptions,
            SUM(pmp.clearances)::int AS clearances,
            SUM(pmp.aerials_won)::int AS aerials_won,
            SUM(pmp.dribbles_completed)::int AS dribbles_completed,
            SUM(pmp.saves)::int AS saves,
            SUM(pmp.yellow_cards)::int AS yellow_cards,
            SUM(pmp.red_cards)::int AS red_cards
     FROM player_match_performance pmp
     JOIN matches m ON m.id = pmp.match_id
     JOIN players p ON p.id = pmp.player_id
     JOIN clubs c ON c.id = pmp.club_id
     WHERE m.season = $1 AND m.state = 'Played'
     GROUP BY pmp.player_id, p.name, c.name, p.archetype_id
     HAVING COUNT(*) >= 1`,
    [season],
  );
  return res.rows;
}

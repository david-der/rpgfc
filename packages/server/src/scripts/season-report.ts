// Season report — the standing post-run deliverable for sim/balance work.
//
// Reads any save DB and writes one markdown report covering every played
// season: cross-season comparison up top, then per season a final table
// (with each club's tactic and leading scorer), league leaders, and a
// league-health panel (goals/match, draws, discipline, injuries, subs,
// xG reconciliation, home/away split).
//
// Usage:
//   pnpm season-report [--db saves/dev.db] [--out path/to/REPORT.md]
//
// Default output: tests/playtest/results/SEASON_REPORT-<dbname>.md

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import Database from "better-sqlite3";

interface Args {
  dbPath: string;
  outPath: string | null;
}

function parseArgs(argv: string[]): Args {
  const out: Args = { dbPath: "saves/dev.db", outPath: null };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    const valueOf = (name: string): string | null => {
      if (arg.startsWith(`${name}=`)) return arg.slice(name.length + 1);
      if (arg === name) {
        const next = argv[i + 1];
        if (next && !next.startsWith("--")) {
          i += 1;
          return next;
        }
      }
      return null;
    };
    const db = valueOf("--db");
    if (db !== null) out.dbPath = db;
    const outArg = valueOf("--out");
    if (outArg !== null) out.outPath = outArg;
  }
  return out;
}

interface MatchRow {
  season: number;
  home_club_id: number;
  away_club_id: number;
  home_goals: number;
  away_goals: number;
}

interface ClubRow {
  id: number;
  name: string;
}

interface TacticRow {
  club_id: number;
  playing_style: string;
  instructions_json: string;
}

interface ScorerRow {
  player_id: number;
  name: string;
  club_id: number;
  goals: number;
  assists: number;
  shots: number;
  xg: number;
  minutes: number;
}

interface EventCounts {
  yellows: number;
  reds: number;
  injuries: number;
  subs: number;
  distinctSubMinutes: number;
}

interface TableLine {
  clubId: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
}

function computeTable(matches: readonly MatchRow[]): TableLine[] {
  const lines = new Map<number, TableLine>();
  const line = (clubId: number): TableLine => {
    let existing = lines.get(clubId);
    if (!existing) {
      existing = { clubId, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0 };
      lines.set(clubId, existing);
    }
    return existing;
  };
  for (const match of matches) {
    const home = line(match.home_club_id);
    const away = line(match.away_club_id);
    home.goalsFor += match.home_goals;
    home.goalsAgainst += match.away_goals;
    away.goalsFor += match.away_goals;
    away.goalsAgainst += match.home_goals;
    if (match.home_goals > match.away_goals) {
      home.won += 1;
      home.points += 3;
      away.lost += 1;
    } else if (match.home_goals < match.away_goals) {
      away.won += 1;
      away.points += 3;
      home.lost += 1;
    } else {
      home.drawn += 1;
      away.drawn += 1;
      home.points += 1;
      away.points += 1;
    }
  }
  return [...lines.values()].sort(
    (a, b) =>
      b.points - a.points ||
      b.goalsFor - b.goalsAgainst - (a.goalsFor - a.goalsAgainst) ||
      b.goalsFor - a.goalsFor,
  );
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const here = dirname(fileURLToPath(import.meta.url));
  const repoRoot = resolve(here, "../../../..");
  const dbPath = resolve(repoRoot, args.dbPath);
  if (!existsSync(dbPath)) {
    console.error(`No save DB at ${dbPath}. Pass --db <path>.`);
    process.exit(1);
  }
  const dbName = basename(dbPath).replace(/\.db$/, "");
  const outPath = resolve(
    repoRoot,
    args.outPath ?? `tests/playtest/results/SEASON_REPORT-${dbName}.md`,
  );
  mkdirSync(dirname(outPath), { recursive: true });

  const db = new Database(dbPath, { readonly: true });
  const clubs = new Map<number, string>(
    db
      .prepare<[], ClubRow>(`SELECT id, name FROM clubs`)
      .all()
      .map((club) => [club.id, club.name]),
  );
  const tactics = new Map<number, string>(
    db
      .prepare<[], TacticRow>(`SELECT club_id, playing_style, instructions_json FROM tactics`)
      .all()
      .map((tactic) => {
        let instructions: string[] = [];
        try {
          const parsed = JSON.parse(tactic.instructions_json) as unknown;
          if (Array.isArray(parsed)) instructions = parsed.filter((x) => typeof x === "string");
        } catch {
          // fall through to style-only label
        }
        const label =
          instructions.length > 0
            ? `${tactic.playing_style} (${instructions.join(", ")})`
            : tactic.playing_style;
        return [tactic.club_id, label];
      }),
  );

  const seasons = db
    .prepare<[], { season: number }>(
      `SELECT DISTINCT season FROM matches WHERE state = 'Played' ORDER BY season`,
    )
    .all()
    .map((row) => row.season);

  const sections: string[] = [];
  const comparison: string[] = [
    `| Season | Champion | Tactic | Pts | Goals/match | Draws | 0-0s | Top scorer |`,
    `|---|---|---|---|---|---|---|---|`,
  ];

  for (const season of seasons) {
    const matches = db
      .prepare<[number], MatchRow>(
        `SELECT season, home_club_id, away_club_id, home_goals, away_goals
         FROM matches WHERE state = 'Played' AND season = ? ORDER BY id`,
      )
      .all(season);
    const table = computeTable(matches);
    const scorers = db
      .prepare<[number], ScorerRow>(
        `SELECT pmp.player_id, p.name, pmp.club_id,
                SUM(pmp.goals) AS goals, SUM(pmp.assists) AS assists,
                SUM(pmp.shots) AS shots, SUM(pmp.xg_x100) / 100.0 AS xg,
                SUM(pmp.minutes_played) AS minutes
         FROM player_match_performance pmp
         JOIN players p ON p.id = pmp.player_id
         JOIN matches m ON m.id = pmp.match_id
         WHERE m.season = ?
         GROUP BY pmp.player_id
         ORDER BY goals DESC, xg DESC`,
      )
      .all(season);
    const events = db
      .prepare<[number], EventCounts>(
        `SELECT
           SUM(e.kind = 'Card' AND e.outcome = 'yellow') AS yellows,
           SUM(e.kind = 'Card' AND e.outcome = 'red') AS reds,
           SUM(e.kind = 'Injury') AS injuries,
           SUM(e.kind = 'Substitution') AS subs,
           COUNT(DISTINCT CASE WHEN e.kind = 'Substitution' THEN e.minute END) AS distinctSubMinutes
         FROM match_events e JOIN matches m ON m.id = e.match_id
         WHERE m.season = ?`,
      )
      .get(season)!;

    const totalGoals = matches.reduce((sum, m) => sum + m.home_goals + m.away_goals, 0);
    const draws = matches.filter((m) => m.home_goals === m.away_goals).length;
    const nilNils = matches.filter((m) => m.home_goals === 0 && m.away_goals === 0).length;
    const homeWins = matches.filter((m) => m.home_goals > m.away_goals).length;
    const awayWins = matches.filter((m) => m.home_goals < m.away_goals).length;
    const totalXg = scorers.reduce((sum, s) => sum + s.xg, 0);
    const goalsPerMatch = (totalGoals / Math.max(1, matches.length)).toFixed(2);
    const drawShare = `${Math.round((draws / Math.max(1, matches.length)) * 100)}%`;

    const topScorerByClub = new Map<number, ScorerRow>();
    for (const scorer of scorers) {
      const current = topScorerByClub.get(scorer.club_id);
      if (!current || scorer.goals > current.goals) topScorerByClub.set(scorer.club_id, scorer);
    }

    const champion = table[0];
    const leader = scorers[0];
    if (champion && leader) {
      comparison.push(
        `| ${season} | ${clubs.get(champion.clubId) ?? champion.clubId} | ${
          tactics.get(champion.clubId) ?? "—"
        } | ${champion.points} | ${goalsPerMatch} | ${drawShare} | ${nilNils} | ${leader.name} (${leader.goals}) |`,
      );
    }

    const tableLines = [
      `| # | Club | Tactic | W | D | L | GF | GA | GD | Pts | Leading scorer |`,
      `|---|---|---|---|---|---|---|---|---|---|---|`,
      ...table.map((lineEntry, index) => {
        const top = topScorerByClub.get(lineEntry.clubId);
        const scorerLabel = top && top.goals > 0 ? `${top.name} (${top.goals})` : "—";
        const gd = lineEntry.goalsFor - lineEntry.goalsAgainst;
        return `| ${index + 1} | ${clubs.get(lineEntry.clubId) ?? lineEntry.clubId} | ${
          tactics.get(lineEntry.clubId) ?? "—"
        } | ${lineEntry.won} | ${lineEntry.drawn} | ${lineEntry.lost} | ${lineEntry.goalsFor} | ${
          lineEntry.goalsAgainst
        } | ${gd >= 0 ? `+${gd}` : gd} | **${lineEntry.points}** | ${scorerLabel} |`;
      }),
    ];

    const leaderLines = [
      `| Player | Club | Goals | Assists | Shots | xG | Minutes |`,
      `|---|---|---|---|---|---|---|`,
      ...scorers
        .slice(0, 8)
        .map(
          (s) =>
            `| ${s.name} | ${clubs.get(s.club_id) ?? s.club_id} | ${s.goals} | ${s.assists} | ${
              s.shots
            } | ${s.xg.toFixed(1)} | ${s.minutes} |`,
        ),
    ];

    sections.push(
      [
        `## Season ${season}`,
        ``,
        `### Final table`,
        ``,
        ...tableLines,
        ``,
        `### Leading scorers`,
        ``,
        ...leaderLines,
        ``,
        `### League health`,
        ``,
        `- Goals/match **${goalsPerMatch}** · draws **${drawShare}** (${nilNils} scoreless) · home/draw/away **${homeWins}/${draws}/${awayWins}**`,
        `- Discipline: **${events.yellows}** yellows, **${events.reds}** reds · injuries **${events.injuries}** · substitutions **${events.subs}** across ${events.distinctSubMinutes} distinct minutes`,
        `- xG **${totalXg.toFixed(1)}** vs goals **${totalGoals}** (${totalGoals > 0 ? ((totalXg / totalGoals - 1) * 100).toFixed(0) : "—"}% model delta)`,
        ``,
      ].join("\n"),
    );
  }

  const report = [
    `# Season Report — ${dbName}`,
    ``,
    `Played seasons: ${seasons.join(", ")} · ${clubs.size} clubs · source \`${args.dbPath}\``,
    ``,
    `## Cross-season comparison`,
    ``,
    ...comparison,
    ``,
    ...sections,
  ].join("\n");

  writeFileSync(outPath, report);
  db.close();
  console.log(`📄 ${outPath}`);
}

main();

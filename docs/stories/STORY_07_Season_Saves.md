# RPG FC — Story 07

## Full Season, Save Slots & Transfer Windows

Story 06 gave the game a heartbeat — a deterministic match engine, a
half-season of fixtures, and a form sparkline. Story 07 gives it a
**memory and a rhythm**. The half-season becomes a full 38-match-week
season for a 20-club league, progress is persisted in named save
slots, transfer windows open and close at defined match weeks, and at
the end of Season 0 the player rolls into Season 1 carrying their
squad forward.

The game's time system is **Season N, Match Week M** — no calendar
dates, no years, no months. This is a deliberate aesthetic choice:
dates place the game in the 2030s and break the timeless quality the
product thesis demands.

---

## Story Metadata

| Field | Value |
|---|---|
| Story ID | RPGFC-07 |
| Phase | Phase 4 — Persistence |
| Estimate | 2 weeks solo, or ~10–14 focused Claude Code sessions |
| Depends on | RPGFC-00 through RPGFC-06 |
| Blocks | RPGFC-08 (Meta) |
| References | PRD §4.8, §10; TDD v2 §10; Style Guide §6, §10 |
| Status | Ready for implementation |

---

## 1. Summary

Three connected pieces:

**Full season.** The 10-club half-season stub from Story 06 becomes a
20-club, 38-match-week full season. Every club plays every other club
twice — once home, once away. The round-robin generator already
handles this; Story 07 doubles the schedule and expands the seed.

**Save slots.** Progress is persisted to named save slots. In local
dev each slot is a separate SQLite file under `./saves/`. The user
can create, load, and delete slots from a `/saves` page. Every
mutating API call already lives inside a Drizzle transaction against
the active connection — the "save" is the database itself, not a
snapshot button.

**Transfer windows.** The bid machine from Story 04 gains a guard:
bids can only be submitted during open transfer windows. Story 07
ships two windows per season — a pre-season window (match weeks 1–4)
and a mid-season window (match weeks 19–22). Outside these windows
the `/transfers` page shows the listings but the Bid Composer is
disabled with a qualitative explanation.

### 1.1 Why this story next

Without save slots the user replays from scratch on every `pnpm dev`
restart. Without a full season the game loop is half a season long
and then stops. Without transfer windows the market is always open
and there's no urgency to buy. Story 07 is the minimum viable
persistence layer.

### 1.2 User value

Boot the game, create a save slot named "My First Run", play through
38 match weeks clicking Advance, buy players during the two transfer
windows, watch the squad evolve across a full season, end the
season, see a summary, roll into Season 1 with the same squad. Quit,
reopen, load the save, continue. The game finally **remembers**.

### 1.3 Not goals

- **No Postgres schema-per-slot.** TDD §10 specifies this for prod;
  Story 07 ships SQLite file-per-slot only. The Postgres adaptation
  lands with Story 09 (AWS).
- **No auto-advance / week pacing.** The user still clicks the
  Advance button manually. Auto-pacing is a polish item for a later
  story.
- **No mid-season transfers by AI clubs.** Rival clubs still don't
  bid autonomously.
- **No relegation / promotion.** One division, flat league.
- **No end-of-season awards.** Story 08 meta handles this.
- **No Legacy Hall.** Story 08.
- **No save export / import.** The SQLite file is the save; export
  is `cp`. A proper export UX lands later.

---

## 2. Technical Additions

### 2.1 Expand to 20 clubs

The world seed config changes from `clubCount: 10` to
`clubCount: 20`. `playersPerClub` stays at 20 (400 total players).
The round-robin schedule doubles: 38 match weeks, 10 fixtures per
week, 380 total fixtures.

The schedule generator from Story 06 already handles any even club
count. The only code change is the seed config + doubling the
schedule (both halves). Story 06's `generateRoundRobin` returns one
half-season; Story 07 adds a `generateFullSeason` wrapper that
mirrors the fixtures with swapped home/away for match weeks 20–38.

### 2.2 Season + match-week time model

```ts
// @rpgfc/shared/src/types/season.ts

export interface SeasonState {
  season: number;       // 0-indexed
  matchWeek: number;    // 1..38 (or 0 = pre-season)
  /** Whether a transfer window is currently open. Derived from
   *  the match-week number against the window ranges. */
  transferWindowOpen: boolean;
}

export const TRANSFER_WINDOWS: Array<{ from: number; to: number }> = [
  { from: 1, to: 4 },    // pre-season window
  { from: 19, to: 22 },  // mid-season window
];
```

The DB stores `season` on the `matches` table (new column, default 0)
and on a new `save_state` row that tracks the current season and
next-match-week pointer.

### 2.3 Save state table

```
save_state     id INTEGER PRIMARY KEY (always 1 — singleton row),
               save_name TEXT NOT NULL,
               season INTEGER NOT NULL DEFAULT 0,
               next_match_week INTEGER NOT NULL DEFAULT 1,
               created_at TEXT NOT NULL,
               updated_at TEXT NOT NULL
```

One row per save file. The dev-server auto-creates it on first boot
with `save_name = "Default"`. The `/saves` page lets the user create
new saves and switch between them by changing the active SQLite file.

### 2.4 Save slot file model

```
./saves/
  default.db        ← created on first `pnpm dev`
  my-first-run.db   ← user-created via /saves
  playoff-test.db   ← user-created via /saves
```

Each file is a complete, self-contained SQLite database. The
`DATABASE_URL` env var points at the active file. Creating a new
save copies the current file (with world + squad + tactics intact)
or generates a fresh world. Loading a save restarts the server with
a different `DATABASE_URL`.

For Story 07's scope, switching saves **requires a server restart**.
The `/saves` page lists the available `.db` files and lets the user
pick one. The dev server reboots with the new file path. This is
crude but correct — a hot-swap mechanism (closing the SQLite
connection and reopening another) can land in a polish story.

### 2.5 Transfer window guard

The `submitBid` handler gains a guard: if the current match week is
outside both transfer window ranges, the handler returns 403 with
`reason: "transfer_window_closed"`. The `/transfers` page reads
`SeasonState.transferWindowOpen` and conditionally disables the
BidComposer with a qualitative message: _"The transfer window is
closed. It reopens at Match Week N."_

### 2.6 Full-season schedule

`generateFullSeason(clubIds)` calls `generateRoundRobin(clubIds)`
for the first half (match weeks 1–19) and mirrors it for the second
half (match weeks 20–38) by swapping home/away on every fixture.
The seed stores both halves as `Scheduled` rows at world gen time.

### 2.7 Season rollover

`POST /api/season/end` fires when every fixture in the current
season is `Played`. It:

1. Increments `save_state.season` to `N + 1`.
2. Resets `save_state.next_match_week` to 1.
3. Generates a new 38-match-week schedule for Season N+1.
4. Adjusts contracts: decrements `seasons_remaining` by 1; expired
   contracts (0 remaining) are deleted and the player becomes a
   free agent.
5. Returns a `SeasonSummary` with the final league table, the
   user's finishing position, and a short narrative sentence.

### 2.8 League table

`GET /api/season/table` returns the current standings:

```ts
export interface LeagueTableRow {
  clubId: number;
  clubName: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}
```

The table is computed from `matches` rows — not stored as a
separate entity. Points, GD, and position are allowlisted numerics
on the `/fixtures` page since they describe concrete facts about
the league, not player ratings.

### 2.9 UI changes

- **"Matchday" → "Match Week"** in every UI surface. The DB column
  stays `matchday` for backwards compatibility.
- **`/fixtures` header** shows "Season 0 — Match Week 7" instead of
  just "Matchday 7".
- **`/fixtures` league table** — a collapsible section below the
  fixture list showing the current standings.
- **`/saves`** — new page: List archetype. Shows available save
  slots, a "New save" button, and a "Load" button per slot.
- **`/season-end`** — appears after the final match week, showing
  the season summary + a "Start next season" button.
- **Transfer window status** — a banner at the top of `/transfers`
  showing whether the window is open and when it next opens/closes.
- **Nav** stays at 7 items — no new entry. The Saves page is
  accessed from a gear icon in the AppShell header, not from the
  primary nav.

### 2.10 Allowlisted numerics

Existing allowlists from Story 06 stay. New ones:

- `match-week-allowlist-number` (replaces `matchday-allowlist-number`)
- `season-allowlist-number`
- `league-table-allowlist-number` (P/W/D/L/GF/GA/GD/Pts columns)

---

## 3. Acceptance Criteria

### 3.1 Full season

**AC-01** — 20 clubs seed correctly, 380 fixtures generated.
- **Verified by** `packages/server/src/test/full-season.test.ts`.

**AC-02** — Advancing 38 times plays the full season; the 39th call
returns `{ remaining: 0 }`.
- **Verified by** same test.

### 3.2 Season state

**AC-03** — `save_state` row tracks current season + next match week.
- **Verified by** `packages/server/src/test/season-state.test.ts`.

**AC-04** — After the full season, `POST /api/season/end` increments
the season, generates 380 new fixtures, and decrements contract
seasons.
- **Verified by** `packages/server/src/test/season-end.test.ts`.

### 3.3 Transfer windows

**AC-05** — Bids during match weeks 1–4 succeed; bids during match
week 5 return 403 `transfer_window_closed`.
- **Verified by** `packages/server/src/test/transfer-window.test.ts`.

**AC-06** — `/transfers` page shows a "window closed" banner when
outside the transfer period.
- **Verified by** `tests/doctrine/transfer-window.spec.ts`.

### 3.4 League table

**AC-07** — `GET /api/season/table` returns 20 rows sorted by points
DESC, goal difference DESC.
- **Verified by** `packages/server/src/test/league-table.test.ts`.

### 3.5 Save slots

**AC-08** — `GET /api/saves` lists available `.db` files.
- **Verified by** `packages/server/src/test/saves-route.test.ts`.

**AC-09** — `POST /api/saves` creates a new save slot (copies the
current DB file or generates a fresh world).
- **Verified by** same test.

### 3.6 UI — Match Week terminology

**AC-10** — Every former "Matchday" label in the UI reads
"Match Week". No calendar date appears anywhere.
- **Verified by** `tests/doctrine/match-week.spec.ts`.

### 3.7 Doctrine

**AC-11** — Full doctrine suite exits 0 with ≥50 specs.
- **Verified by** `pnpm doctrine`.

---

## 4. Out of Scope

- Postgres schema-per-slot (Story 09)
- Auto-advance / week pacing
- AI club transfers
- Relegation / promotion
- End-of-season awards (Story 08)
- Legacy Hall (Story 08)
- Save export / import UI
- Hot-swap save loading (requires server restart in Story 07)

---

## 5. Definition of Done

- 20 clubs, 38 match weeks, full season playable end-to-end.
- Save slots persist across server restarts.
- Transfer windows gate bids to match weeks 1–4 and 19–22.
- Season rollover advances to Season 1 with the squad intact.
- "Match Week" everywhere, never "Matchday" or a calendar date.
- League table renders with all-allowlisted numerics.
- All prior doctrine specs still pass.

---

## 6. Risks

### 6.1 20 clubs × 20 players = 400 players to generate

**Mitigation:** The generator is already deterministic and fast
(< 2s for 200 players in Story 06). 400 players in < 4s is
acceptable for a dev boot.

### 6.2 Save-slot switching requires a server restart

**Mitigation:** Documented in the UI. A hot-swap mechanism is a
polish item — the data shape doesn't change, only the connection
management.

### 6.3 Transfer window timing feels arbitrary

**Mitigation:** The windows are configurable constants. Story 07
ships sensible defaults; future stories can expose them to the
user as a run modifier.

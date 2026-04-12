# RPG FC — Story 06

## Match Engine, Fixtures & Form

Story 05 taught the game how to deploy a player. Story 06 teaches it
how to **play the games**. A deterministic in-process simulator runs
every fixture in the league, writes a match row, attaches a
performance row to every player who took the pitch, and the form
sparkline on every profile updates the next time the user lands on it.
The Python sim from TDD v2 §9 is still deferred — Story 06 ships the
stub behind the same `SimEngine` interface so the swap is one env-var
change away.

---

## Story Metadata

| Field | Value |
|---|---|
| Story ID | RPGFC-06 |
| Phase | Phase 3 — Decisions with Consequences |
| Estimate | 2 weeks solo, or ~10–14 focused Claude Code sessions |
| Depends on | RPGFC-00, RPGFC-01, RPGFC-02, RPGFC-03, RPGFC-04, RPGFC-05 |
| Blocks | RPGFC-07 (Save slots + seasons), RPGFC-08 (Meta) |
| References | PRD §4.4, §9.4, §9.5; TDD v2 §6, §9, §18; Style Guide §5, §8, §10 |
| Status | Ready for implementation |

---

## 1. Summary

The first moment the manager is a **coach who lives with results**.
Click `Advance` on `/fixtures`, watch every fixture in the next
matchday play out at once, open a match card, read a 3-paragraph
report that names two or three players and tells the story of the
game in prose — no XG percentages, no shot maps, no
"Possession 64%". On the player profile, the form sparkline grows a
new dot in the matching tier color and the prose Overview block
quietly rephrases itself to reflect what just happened.

The match engine is a **stub** in v1: a seeded PRNG, badge counts as
strength, truncated-Poisson goals, and a small narrative pool for
event copy. The interface it exposes — `simulateMatch`,
`advanceMatchday` — is the same one the future Python sim will
implement. Routes never see the stub directly; they call into the
rendering layer which calls into the application layer which calls
the engine via the `SimEngine` interface.

### 1.1 Why this story next

Story 05 delivered the squad-role consequence loop without matches.
Story 06 closes the bigger loop: contract → squad role → starting XI
→ match outcome → form → manager judgment. Until matches exist, the
game has no stake — the player can sign anyone, deploy anyone, and
nothing reads back. Story 06 is the moment the world starts pushing
back.

It also unlocks every later story: Story 07's calendar wraps around
the matchday counter, Story 08's rogue-lite meta reads end-of-run
results, and any badge-from-performance subsystem (a follow-up
story, not this one) reads from `player_match_performance`.

### 1.2 User value

Open `/fixtures`, see a clean matchday-grouped schedule of every
remaining fixture in the half-season, click `Advance to next
matchday`, watch six results land in a soft animation, click any
result to read the match report, navigate to a player who featured,
see their form sparkline grow a dot. The whole loop is 30 seconds
and feels like the game finally has heartbeat.

### 1.3 Not goals

- **No Python sim integration.** The interface is in place; the stub
  is the only implementation Story 06 ships.
- **No substitutions.** The chosen XI plays the full 90. A subs
  system arrives with in-match management.
- **No in-match management.** No half-time talks, no live tactical
  changes. The match runs to its result and the report renders.
- **No set pieces.** Goals are flat events; corner / free-kick /
  penalty distinctions don't yet exist in the data shape.
- **No injuries or cards.** Players never miss a match for cause in
  Story 06. They can be unavailable only because they aren't pinned.
- **No tactical familiarity decay.** PRD §9.2's familiarity mechanic
  is deferred — every starter contributes their full value.
- **No multiple competitions.** League only. Cup / European deferred.
- **No save slot or season rollover.** Story 07 wires both. Story 06
  ships **one half-season** (18 matchdays for a 10-club league) and
  stops at matchday 18. The user can replay the half-season by
  resetting the dev DB.
- **No transfer windows.** Story 07.
- **No badge awards from performances.** A `BadgeAward` subsystem
  watches `player_match_performance` and dispenses badges; that's a
  next-story slice. Story 06 stores the data so the future system
  has something to read.
- **No press conferences, manager mood, or job security.** Deferred.

---

## 2. Technical Additions

### 2.1 Sim engine interface

```ts
// packages/server/src/sim/interface.ts

export type FormTier = "Excellent" | "Good" | "Average" | "Poor" | "Dreadful";

export interface SimMatchInput {
  matchId: number;
  matchday: number;
  seed: number;
  home: SimSide;
  away: SimSide;
}

export interface SimSide {
  clubId: number;
  /** Eleven players in the order they appear in the tactics
   *  assignments. The engine fills empty slots from squad_entries
   *  in role order (Starter > Rotation > Backup > Youth) so a
   *  manager who never opens /tactics still gets a sensible XI. */
  starters: SimPlayer[];
}

export interface SimPlayer {
  playerId: number;
  /** Sum of badge counts on this player. The stub uses this as the
   *  scalar strength contribution; Story 06 deliberately keeps the
   *  shape boring so the Python sim can replace it with anything
   *  richer without changing the interface. */
  badgeCount: number;
  /** Whether the player is in a slot that fits their archetype. The
   *  stub bonuses fit and penalises misfit. */
  positionFit: boolean;
}

export interface SimMatchResult {
  matchId: number;
  homeGoals: number;
  awayGoals: number;
  performances: SimPerformance[];
}

export interface SimPerformance {
  playerId: number;
  clubId: number;
  goals: number;
  assists: number;
  /** Qualitative — tier word, not a 0..10 rating. The stub picks
   *  one of five tiers per player using the per-match PRNG and the
   *  player's contribution to the team's strength. */
  tier: FormTier;
  /** A short event description, if the engine generated one for
   *  this player ("opened the scoring after a flowing move"). */
  eventDescription: string | null;
}

export interface SimEngine {
  simulateMatch(input: SimMatchInput): SimMatchResult;
}
```

### 2.2 Sim engine stub

```
packages/server/src/sim/
  interface.ts        — public types (above)
  stub.ts             — deterministic implementation
  prose.ts            — small templated phrase pool for events
```

Stub algorithm (every line is intentional and pinned by tests):

1. **Seeding.** `seed = hash(matchId, matchday, homeClubId, awayClubId)`,
   wrapped in `mulberry32` for the per-match PRNG.
2. **Strength.** Each side's strength is
   `sum(starter.badgeCount + (positionFit ? 1 : 0))` plus a flat
   home advantage of `+2`.
3. **Win probability.** A logistic curve over the strength delta:
   `pHome = 1 / (1 + exp(-(strHome - strAway) / 4))`. Clamped to
   `[0.1, 0.9]` so neither side ever has zero chance.
4. **Goals.** Each side draws goals from a truncated Poisson with
   `lambda = clamp(1 + 2 * pSide, 0.4, 4.5)` where `pSide` is the
   side's win probability. The cap is 5 to avoid the occasional
   silly 8-0.
5. **Goal scorers.** Each goal is attributed to a starter, weighted
   by `badgeCount + (positionFit ? 1 : 0)`. The engine biases
   forward-archetype slots (`ST*`, `LW`, `RW`, `AMC`).
6. **Assists.** Each goal flips a coin (PRNG-driven) to attach an
   assister, drawn from the same weighted pool, never the same
   player as the scorer.
7. **Performance tiers.** Every starter gets a tier:
   - Goal-scorers and assist-makers float toward `Good` / `Excellent`.
   - Players on the losing side without a goal float toward
     `Poor` / `Dreadful`.
   - Everyone else clusters around `Average` with PRNG noise.
8. **Event descriptions.** The two highest-tier performers per side
   get a short event sentence drawn from `prose.ts` ("opened the
   scoring with a sharp turn", "anchored the back three through a
   nervous opening half"). Everyone else's `eventDescription` is
   `null`.

The whole stub is **deterministic for a given seed** — re-running
`simulateMatch` with the same input returns identical output. A test
pins this.

### 2.3 Schedule generation

Round-robin algorithm: for `n` clubs (n is even, Story 06 ships 10),
generate `n − 1` matchdays where every club plays exactly once. Half-
season = `n − 1` matchdays = 9 for a 10-club league. Story 06 ships
one half-season (9 matchdays). Story 07 will mirror it for the second
half. The schedule is committed deterministically per world seed.

```
packages/server/src/application/season/
  schedule.ts    — generateRoundRobin(clubIds, seed): MatchPair[][]
  seed.ts        — seedFixturesIfEmpty(client) — runs after seedSquad
                   on world gen
  advance.ts     — advanceMatchday(client) — picks the next matchday
                   in `Scheduled` state, simulates every fixture,
                   writes match + per-player performance rows
```

### 2.4 Database

New tables, both dialects:

```
matches                    id, matchday, home_club_id, away_club_id,
                           state ('Scheduled' | 'Played'),
                           home_goals INTEGER NULL,
                           away_goals INTEGER NULL,
                           seed INTEGER NOT NULL,
                           played_at TEXT NULL

player_match_performance   id, match_id, player_id, club_id,
                           goals INTEGER NOT NULL DEFAULT 0,
                           assists INTEGER NOT NULL DEFAULT 0,
                           tier TEXT NOT NULL,
                           event_description TEXT NULL,
                           UNIQUE(match_id, player_id)
```

Indexes on `matches(matchday)`, `matches(state)`,
`player_match_performance(player_id)`,
`player_match_performance(match_id)`. Portability scan stays green
(no JSONB, no ARRAY, no native enum).

### 2.5 Application layer

```
packages/server/src/application/season/
  schedule.ts            — round-robin generator
  seed.ts                — seedFixturesIfEmpty
  advance.ts             — advanceMatchday: picks next Scheduled
                           matchday, calls SimEngine for each fixture,
                           writes results, returns the match ids
  starter-picker.ts      — pickStarters(tactics, squad): SimSide
                           Falls back to squad-role order when slots
                           are empty so a never-opened /tactics still
                           produces a valid XI

packages/server/src/application/players/
  form.ts                — recentFormFor(playerId, n=5): FormTier
                           Pure function over the last n
                           player_match_performance rows. Story 05's
                           form-tier prose stub is replaced by this.
```

### 2.6 Rendering layer

```
rendering/
  match-response.ts      — renderMatch(matchId): RenderedMatch with
                           prose-built narrative + per-player line
  fixtures-response.ts   — renderFixtures(): grouped-by-matchday
                           list of upcoming + recent fixtures for
                           the user's club
  player-form.ts         — renderFormFor(playerId): FormSeries shape
                           consumed by the FormSparkline on the
                           profile (one tier word per played match
                           in chronological order)
```

`RenderedMatch` carries:
- `id`, `matchday`, `state`
- `home`, `away` ({ id, name, colors, goals })
- `narrative`: 2–3 short paragraphs of prose stitched from the
  highest-tier performers and the scoreline
- `performances`: per-player rows with tier word, goals, assists,
  optional event description

The narrative builder is a small templated function in
`rendering/prose/match.ts` — same shape as the existing prose
modules under `rendering/prose/`.

### 2.7 Routes

```
GET  /api/fixtures             — RenderedFixturesPage for the user's club
GET  /api/matches/:id          — RenderedMatch for a specific fixture
POST /api/season/advance       — simulate the next matchday, return
                                 the count of matches played + the
                                 new current matchday number
GET  /api/players/:id/form     — FormSeries for the profile sparkline
                                 (kept on its own endpoint so the
                                 profile can stay paginated)
```

The advance endpoint is **not** dev-only — once Story 06 ships, the
manager always has a way to push the season forward. Story 07 wraps
this in a calendar with auto-advance + week-pacing; Story 06 keeps
the button manual.

### 2.8 UI

New routes:

- **`/fixtures`** — List archetype. Matchday-grouped cards. The
  active matchday header has the prominent **Advance to next
  matchday** button (a single Editor archetype affordance inside a
  list page is fine — Style Guide §10 explicitly allows this for
  pages whose primary action is a global mutation).
- **`/matches/$id`** — Profile-archetype reading destination. A
  hero with the two club shields, the scoreline (allowlisted),
  the matchday eyebrow, and a Newsreader prose body with drop-cap.
  Below the prose: a `MatchPerformanceList` showing every player
  who took the pitch with their tier chip + goal/assist counts.

Updated routes:

- **`/players/$id`** Overview gains a `FormSparkline` row above the
  Facts list. Sparkline y-axis labels are tier words, never numbers.
- **`/players/$id`** new sibling tab **Form** carrying a larger
  version of the sparkline + the most recent five match cards.
- **Primary nav** grows to **Home / Players / Scouts / Transfers /
  Tactics / Squad / Fixtures** (seven entries; the existing NavBar
  test already auto-counts via `PRIMARY_NAV.length`).

New components:

- `MatchReportCard` — the hero on `/matches/$id`. Composes
  `Card`, drop-cap `NarrativeBlock`, and an allowlisted scoreline.
- `MatchPerformanceList` — each row shows player name (player-
  facing), tier chip, goal-allowlisted-number, assist-allowlisted-
  number, and (optional) one-line event description (player-facing).
- `FormSparkline` — Recharts time-series with tier words on the
  y-axis. Five-stop form gradient stroke that interpolates between
  tier colors. Style Guide §8.5.
- `FixtureCard` — list-archetype row for `/fixtures`. Two club
  names, the scoreline pill (or "Not yet played"), and a `Link`
  to the match report.
- `ResultPill` — the W/D/L marker (already specified in Style Guide
  §6.7; Story 06 is when it lands in code).
- `AdvanceMatchdayButton` — the primary action chrome on `/fixtures`
  for the active matchday header.

### 2.9 Seed content

- `seedFixturesIfEmpty` — round-robin for the seeded clubs. `seed =
  worldSeed * 31`. Idempotent.
- No backfill of historic results — every fixture starts in the
  `Scheduled` state.

---

## 3. In Scope

### 3.1 Deterministic match outcomes

Same `(seed, matchId, home, away, starters)` → identical
`SimMatchResult` every call. The test pins this against a frozen
seed and a fixed lineup. If the engine ever drifts, the test
catches it on the next CI run.

### 3.2 Starter picking with sensible fallback

If `/tactics` has empty slots, `pickStarters` fills them in order:
first by squad role (`Starter` > `Rotation` > `Backup` > `Youth`),
then by `position-family fit`, then by player id. Every
slot in the active formation always has a player by the time the
sim runs — no "this team played 9 vs 11" surprises.

### 3.3 Form derivation is pure

`recentFormFor(playerId, n=5)` reads the last `n` performances from
`player_match_performance` ordered by `matches.matchday DESC`,
maps each tier to a numeric weight, averages, and re-bucks back to
a `FormTier`. Pure function — the average is internal and never
crosses the rendering boundary.

### 3.4 Match report is prose

`renderMatch` builds a 2–3 paragraph match report from a small
template pool. Every paragraph names the side, references the
scoreline qualitatively (a "narrow" / "comfortable" / "thumping"
adjective from a tier table that maps the goal differential to a
word), and then promotes the highest-tier scorer / assister into
prose. No "Diogo Marques 8.4". A `MatchPerformanceList` row carries
goals + assists as allowlisted numbers, but the body of the report
never reaches into them numerically.

### 3.5 Allowlisted numerics

Three new allowlisted contexts land in Story 06:

- **Scoreline.** `data-testid="match-score-allowlist-number"`.
  `<span>2</span> – <span>1</span>`. Each digit element wears the
  allowlist tag.
- **Matchday number.** `data-testid="matchday-allowlist-number"`.
  Used on `/fixtures` headers and `/matches/$id` eyebrows.
- **Goals / assists per player.** `data-testid="goals-allowlist-
  number"` and `data-testid="assists-allowlist-number"`. These are
  facts, like ages — they belong to the player but they describe a
  *what happened*, not a *how good*.

The doctrine suite explicitly tests each of these allowlists by
asserting that the digit-bearing element has the right
`data-testid` suffix.

### 3.6 Form sparkline never shows numbers

The y-axis labels are the five `FormTier` words. The line color
interpolates the form gradient from Style Guide §2:
`form-dreadful → form-poor → form-average → form-good →
form-excellent`. Tooltips also use tier words. Story 05's
PromiseMoodChip stylings are reused for the per-tick color cells.

### 3.7 Advance is one transaction per matchday

`POST /api/season/advance` opens a single Drizzle transaction,
loads every fixture in the next `Scheduled` matchday, simulates
each one (the stub is fast — < 5ms per match), inserts every match
result + performance row, and commits. If anything fails, nothing
half-lands. Tests cover both the happy path and the "no scheduled
matchdays remain" terminal case.

### 3.8 Nav registry update

`PRIMARY_NAV` grows the Fixtures entry:

```ts
{ key: "fixtures", label: "Fixtures", to: "/fixtures",
  icon: CalendarDays }
```

---

## 4. Out of Scope

- **Python sim** — interface only; flipping `SIM_ENGINE=python` will
  light it up later.
- **Substitutions, injuries, cards, set pieces, in-match management**
  — every one is its own deferred subsystem.
- **Multiple competitions** — league only.
- **Tactical familiarity decay** — deferred indefinitely; the
  starter contributes full strength regardless of how new the
  formation is.
- **Badge awards** — the data shape is in place;
  `BadgeAwardEngine` is a follow-up story.
- **Save slots / season rollover** — Story 07.
- **Press conferences, manager mood, job security** — deferred.
- **Player wages tied to match outcomes** — Story 08 meta.
- **Manager-of-the-month / season awards** — deferred.

---

## 5. Acceptance Criteria

### 5.1 Shared + DB

**AC-01** — Sim interface + new shared types compile.
- **Verified by** `pnpm typecheck`.

**AC-02** — Migration `0005_matches.sql` applies on both dialects;
the portability scan stays green.
- **Verified by** `packages/server/src/test/migrations-portability.test.ts`.

### 5.2 Sim stub determinism

**AC-03** — `simulateMatch` is deterministic for a fixed input.
- **Given** a frozen `SimMatchInput` (clubs A and B, two pinned
  badge counts each, seed 42).
- **When** `simulateMatch` runs twice.
- **Then** both results are deeply equal.
- **Verified by** `packages/server/src/test/sim-stub.test.ts`.

**AC-04** — Goal counts stay in `[0, 5]`.
- **Given** 1000 simulated matches at random strengths.
- **When** the result distribution is collected.
- **Then** every `homeGoals` and `awayGoals` ∈ [0, 5].
- **Verified by** `packages/server/src/test/sim-stub.test.ts`.

**AC-05** — Stronger side wins more often than not.
- **Given** 200 simulated matches where home strength = 30 and
  away strength = 5.
- **Then** ≥ 60% of the results are home wins or draws.
- **Verified by** `packages/server/src/test/sim-stub.test.ts`.

### 5.3 Schedule + advance

**AC-06** — `seedFixturesIfEmpty` creates `n × (n − 1) / 2` matches
for `n` clubs (one half-season).
- **Verified by** `packages/server/src/test/fixtures-seed.test.ts`.

**AC-07** — Every club plays the same number of fixtures.
- **Given** the seeded fixtures.
- **When** the per-club fixture count is computed.
- **Then** the count is `n − 1` for every club.
- **Verified by** `packages/server/src/test/fixtures-seed.test.ts`.

**AC-08** — `advanceMatchday` writes match + performance rows in
one transaction.
- **Given** a fresh seeded world.
- **When** `advanceMatchday` runs.
- **Then** every fixture in matchday 1 is `Played`, every started
  player has a `player_match_performance` row, and the row count
  equals `fixturesPlayed × 22` (eleven players per side).
- **Verified by** `packages/server/src/test/advance.test.ts`.

**AC-09** — Calling `advanceMatchday` after the half-season ends
returns `{ remaining: 0 }` and does not re-simulate.
- **Verified by** `packages/server/src/test/advance.test.ts`.

### 5.4 Form

**AC-10** — `recentFormFor` averages tiers correctly.
- **Given** five performances at tiers
  `[Excellent, Good, Average, Average, Poor]` (weights
  4 + 3 + 2 + 2 + 1 = 12, avg 2.4, rounded to bucket 2).
- **Then** `recentFormFor` returns `Average`.
- **Verified by** `packages/server/src/test/form.test.ts`.

**AC-11** — A player with no performances reports `Average`.
- **Verified by** the same test.

### 5.5 Routes

**AC-12** — `GET /api/fixtures` returns the matchday-grouped list,
no cents anywhere.
- **Verified by** `packages/server/src/test/fixtures-route.test.ts`.

**AC-13** — `GET /api/matches/:id` returns a `RenderedMatch` whose
narrative is non-empty after the fixture has been played.
- **Verified by** `packages/server/src/test/match-route.test.ts`.

**AC-14** — `POST /api/season/advance` returns
`{ matchday: number, played: number }` and persists the results.
- **Verified by** `packages/server/src/test/advance-route.test.ts`.

**AC-15** — `GET /api/players/:id/form` returns a series whose
length equals the number of matches the player played in.
- **Verified by** `packages/server/src/test/form-route.test.ts`.

### 5.6 UI

**AC-16** — `/fixtures` renders matchday-grouped cards and an
`Advance` button on the active matchday header.
- **Verified by** `tests/doctrine/fixtures.spec.ts`.

**AC-17** — Clicking `Advance` plays the next matchday and the
fixture cards re-render with W/D/L pills.
- **Verified by** `tests/doctrine/fixtures.spec.ts`.

**AC-18** — `/matches/$id` renders the prose narrative + a
performance list, and the only digits on the page are inside
elements with the `*-allowlist-number` testids
(`match-score-allowlist-number`, `matchday-allowlist-number`,
`goals-allowlist-number`, `assists-allowlist-number`).
- **Verified by** `tests/doctrine/match-report.spec.ts`.

**AC-19** — `/players/$id` Overview shows a `FormSparkline` whose
y-axis labels are tier words, never digits, and whose chart text
contains no digits.
- **Verified by** `tests/doctrine/form-sparkline.spec.ts`.

**AC-20** — Nav registry reflects Fixtures and active state
resolves on `/fixtures` and `/matches/$id`.
- **Verified by** `tests/doctrine/fixtures-nav.spec.ts`.

### 5.7 Doctrine

**AC-21** — Full doctrine suite still exits 0, now ≥ 45 specs.
- **Verified by** `pnpm doctrine` in CI + locally.

---

## 6. Suggested Task Breakdown

1. **Sim interface + stub.** `sim/interface.ts`, `sim/stub.ts`,
   `sim/prose.ts`. Tests: AC-03, AC-04, AC-05.
2. **Migration `0005_matches.sql`** for both dialects. Test: AC-02.
3. **Round-robin schedule + seed.** `application/season/schedule.ts`,
   `application/season/seed.ts`, wired into `dev-server.ts`. Tests:
   AC-06, AC-07.
4. **Starter picker.** `application/season/starter-picker.ts`.
5. **Advance matchday.** `application/season/advance.ts`. Test: AC-08, AC-09.
6. **Form derivation.** `application/players/form.ts`. Tests: AC-10, AC-11.
7. **Rendering layer.** `rendering/match-response.ts`,
   `rendering/fixtures-response.ts`, `rendering/player-form.ts`,
   `rendering/prose/match.ts`. Plumb form onto `WirePlayer`.
8. **Routes.** `routes/season.ts`, `routes/matches.ts`. Mount in
   `index.ts`. Tests: AC-12 through AC-15.
9. **Backend commit.**
10. **UI components.** `MatchReportCard`, `MatchPerformanceList`,
    `FormSparkline`, `FixtureCard`, `ResultPill`,
    `AdvanceMatchdayButton`.
11. **UI routes.** `/fixtures`, `/matches/$id`, FormSparkline on
    `/players/$id`. Append to `routeTree.gen.ts`.
12. **Nav entry.** Append `fixtures` to `PRIMARY_NAV`.
13. **Doctrine specs.** `fixtures.spec.ts`, `match-report.spec.ts`,
    `form-sparkline.spec.ts`, `fixtures-nav.spec.ts`. Allowlist
    coverage included.
14. **Deliberate-violation walkthrough.** Inject
    `<span data-testid="player-facing">Rating 8.4</span>` into a
    match report, watch ESLint + doctrine fail, revert, document
    in commit.
15. **UI commit.**

---

## 7. Definition of Done

- Every AC-01 through AC-21 passes.
- On a fresh `pnpm dev`, the flow: `/fixtures` → click `Advance` →
  see six results land → click any fixture → read the prose
  match report → navigate to a player who featured → see a new
  dot on the form sparkline. All without a full page reload.
- Every digit on `/matches/$id`, `/fixtures`, and the new
  FormSparkline is inside an `*-allowlist-number` testid OR is on
  a chrome element (matchday count in the nav, etc.).
- Nav has seven items; all seven active-state transitions work
  on deep-link refresh.
- Story 05's tactics + squad surfaces are unaffected; the squad
  page still renders harmony, the tactics page still saves.
- `packages/server/CLAUDE.md` gains §11 "Sim engine boundary"
  documenting the `SimEngine` interface contract and the rule
  that routes never call into `sim/*` directly.
- A deliberate `<span data-testid="player-facing">Rating 8.4</span>`
  injection into any new route is caught by **both** the ESLint
  rule and the doctrine suite.

---

## 8. Review Checklist

### 8.1 Structural

- `SimEngine` interface lives in `sim/interface.ts` and only the
  rendering layer imports `sim/stub.ts`.
- Routes never reach into `application/season/*` directly; the
  `match-response` / `fixtures-response` modules are the only
  bridges.
- `no-hidden-in-routes` rule stays armed.
- `advanceMatchday` runs inside a single transaction.

### 8.2 Content

- Match prose pool has at least 8 distinct templates per scoreline
  band ("narrow", "comfortable", "thumping"), seeded from the per-
  match PRNG so reruns are stable.
- Performance tier mapping is documented in `sim/stub.ts` and
  pinned by a unit test.
- Form sparkline tooltip and y-axis use tier words, never numbers.

### 8.3 Doctrine

- Three new allowlists land:
  `match-score-allowlist-number`,
  `matchday-allowlist-number`,
  `goals-allowlist-number` / `assists-allowlist-number`.
- Each allowlist is documented at its first use site with a one-
  line comment naming the fact (`scoreline`, `matchday`, `goals`).
- Deliberate-violation walkthrough is documented in the UI commit.

### 8.4 Style Guide

- `/matches/$id` follows the Profile archetype: hero with shields
  + scoreline, prose body in `max-w-prose` Newsreader, drop-cap
  on the lead, performance list below.
- `/fixtures` follows the List archetype with the Editor
  affordance (`Advance` button) attached to the active matchday
  header — never a floating action button.
- `FormSparkline` follows Style Guide §8: transparent background,
  horizontal gridlines only, no animation on update, mono tick
  text, tier-word y-axis labels.

---

## 9. Risks & Pitfalls

### 9.1 Numbers leak through the match report

**Risk:** A tired developer slips a "possession 64%" into a match
template and the doctrine scrape misses it because the template
never reaches a `data-testid="player-facing"` element.

**Mitigation:** The match report's prose body is wrapped in a
single `data-testid="player-facing"` element at the
`NarrativeBlock` level. The doctrine spec asserts the body
contains no digit. Even if a number sneaks into a template, the
scrape catches it.

### 9.2 Determinism drift

**Risk:** A future refactor uses `Math.random()` somewhere in the
sim path and the determinism test starts flaking.

**Mitigation:** AC-03 asserts byte-for-byte equality on a fixed
input. `sim/stub.ts` imports the project's `mulberry32` only;
adding `Math.random` anywhere under `sim/` is caught immediately.
A lint rule could enforce this — Story 06 leaves the rule out
because the test is sufficient and adding a custom rule per story
is itself a pitfall.

### 9.3 Form sparkline becomes a rating gauge

**Risk:** A future maintainer adds a numeric tooltip "for clarity"
and turns the sparkline into a 0..10 gauge.

**Mitigation:** AC-19 asserts no digit anywhere in the chart's
rendered DOM. The component itself only takes a `FormTier[]` —
there's no numeric scalar to display by accident.

### 9.4 Sim stub is too random

**Risk:** Stronger sides win 51% of the time and the user can't
feel the merit-must-win pillar.

**Mitigation:** AC-05 pins ≥ 60% non-loss for a 6× strength
differential. Tunable in one place (the logistic constant) so
follow-up balancing is a single-line change with a single test
to update.

### 9.5 The advance button is the wrong affordance

**Risk:** The user expects the matchday to advance automatically.

**Mitigation:** Story 07 turns this into auto-pacing inside the
calendar. Story 06 ships the manual button as the obvious
shortest path; a one-line copy update on the button explains
"Story 07 will tie this to the calendar".

---

## Appendix A — Sample match report (UI copy)

```
────────────────────────────────────────────────
  MATCHDAY 4
────────────────────────────────────────────────

   PORTO   2  –  1   BENFICA

     A comfortable afternoon at the Dragão. Diogo Marques
   opened the scoring with a sharp turn inside the box, and
   Ana Figueira's late strike settled the contest before the
   visitors could find a way back into it.

     Benfica's reply, when it came, was through a flowing
   move down the right that pulled their captain into space
   for a finish that briefly threatened to change the night's
   shape. It did not last.

     A tidy result for the home side. Their back three rarely
   looked troubled.
```

No XG. No possession bar. No 8.4 in sight.

## Appendix B — Sample form sparkline tooltip

```
  ▆▅█▆▅
  ╰─ Hover ─╮
            │
        Last match
        Excellent
```

Tooltip body: tier word + match label. No "rating: 8.4".

## Appendix C — Cross-story references

- **Story 05 (Tactics)** provides the starting XI via
  `tactics.assignments`. Story 06 calls `pickStarters` which falls
  back to squad role order when slots are empty.
- **Story 04 (Transfers)** is unaffected, but signed players
  immediately appear in their new club's next-matchday lineup
  if pinned. The contract's `rolePromise` continues to drive
  Story 05's mood chip; Story 06 doesn't read it.
- **Story 07 (Save slots + seasons)** wraps the matchday counter
  in a calendar, mirrors the round-robin into a full season,
  and adds auto-pacing.
- **Story 08 (Rogue-lite meta)** reads end-of-half-season results
  to award Legacy Points.
- **Future badge subsystem** reads `player_match_performance` to
  award badges (hat-trick → Clutch Finisher progression, run of
  Excellent performances → In-form, etc.).

# RPG FC — Story 09

## Ten-Team Foundation & Complete Player Search

Make the current league size an intentional product contract: one coherent
ten-club league, a full double round-robin season, viable senior squads, and a
player search that can reach every generated footballer.

---

## Story Metadata

| Field | Value |
|---|---|
| Story ID | RPGFC-09 |
| Phase | Play Readiness — Foundation |
| Depends on | RPGFC-00 through RPGFC-08 as implemented |
| Blocks | RPGFC-10, RPGFC-11, RPGFC-12 |
| References | PRD §3, §6, §18.4; TDD v2 §5, §9, §18 |
| Status | Partially implemented; remaining gates are listed below |

## Current Implementation Status

The canonical development world now generates **10 clubs with 20 senior
players each**. Deterministic world generation, the 18-week/90-fixture
schedule, season-aware match seeds, exhaustive cursor pagination, and
server-side name/market filtering have focused SQLite coverage.

This story is not complete. The full UI-to-repository filter and allowlisted
sort contract, atomic failure behavior for impossible generation
configurations, live Postgres parity, and the deterministic five-season gate
have not been verified. The implementation currently supplies the canonical
league values to world generation rather than exposing the named
`LeagueConfig` described as the target architecture below.

## 1. Supersession Notice

This story supersedes only the league-scale portions of Story 07. The first
playable league has **10 clubs, 18 match weeks, 5 fixtures per week, and 90
fixtures per season**. The 20-club expansion is deferred until the mechanics
are balanced and is not an acceptance criterion for play readiness.

Story 06's half-season language and Story 07's 20-club/38-week assumptions are
historical. Existing persistence, standings, rollover, and full-season code
remain valid where they conform to this ten-team contract.

## 2. User Outcome

A new game always produces a recognizable ten-club competition with complete
and positionally usable squads. The manager can search and filter the entire
roughly 200-player senior population rather than an arbitrary first page, and
can play repeated seasons without fixture, seed, or roster corruption.

## 3. In Scope

- A named configuration object for the ten-team league contract.
- Ten unique fictional clubs belonging to one coherent league identity.
- A deterministic baseline senior population of exactly 20 players per club;
  future configuration may support the 20–24 range without changing the
  ten-team product contract.
- Explicit positional floor validation during world generation.
- A double round-robin schedule: every pair meets once home and once away.
- Season-aware deterministic match seeds.
- Server-side player filtering and sorting before pagination.
- Stable cursor pagination across the complete player population.
- A deterministic multi-season foundation harness for both database dialects.

### 3.1 Positional floors

For the implemented 20-player baseline, every generated senior squad must
contain at least:

- 2 goalkeepers;
- 6 defender-family players;
- 6 midfielder-family players;
- 5 forward-family players;
- exactly 20 total players.

Generation may satisfy these constraints through a position-template pass or
a deterministic repair pass. If a later configuration permits larger squads,
it must never silently create players outside the configured 20–24 range.

### 3.2 Search contract

The completed search contract accepts server-side filters for name, club,
position family, certainty, watchlist state, and market availability where the
underlying feature exists. Sorting uses an allowlisted key plus `player.id` as
a stable tiebreaker. Filtering occurs in SQL before `LIMIT`; the response
cursor points to the last row actually returned after filtering. Today,
name, club, position family, and market availability are repository filters;
some visible scouting filters still run client-side and the allowlisted sort
contract remains open.

## 4. Out of Scope

- Expansion to 20 clubs, promotion, relegation, cups, or multiple leagues.
- Transfer-market behavior changes beyond truthful availability filtering.
- Scouting knowledge changes; those belong to RPGFC-10.
- Match-engine changes; those belong to RPGFC-11.
- Fatigue, injury, suspension, or rotation; those belong to RPGFC-12.
- Youth intake quality, training, development, board objectives, and economy
  balancing.

## 5. Architecture & Invariants

- `LeagueConfig` is application configuration, not duplicated route constants.
- World, season, and match seeds are derived from explicit inputs. No code in
  generation, scheduling, or the harness calls `Math.random()`.
- A match seed includes world/run seed, season, match week, and both club IDs.
- Schedule construction remains a pure function over ordered unique club IDs.
- Search remains repository-driven and dual-dialect; routes never filter an
  already limited result set.
- Generated club names are validated for normalized uniqueness before commit.
- World generation is atomic: a failed invariant leaves no partial world.

## 6. Acceptance Criteria

**AC-01 — Deterministic ten-team world**  
Given the same empty database and world seed, generating twice produces the
same ordered clubs, players, squad composition, and season fixtures.

**AC-02 — Unique coherent clubs**  
Exactly ten clubs are generated, normalized club names are unique, and every
club draws from the configured league identity rather than unrelated regional
pools.

**AC-03 — Valid senior squads**  
Every club has exactly 20 senior players for the baseline configuration and
satisfies all positional floors in §3.1. Any future 20–24 configuration must
obey the same configured bounds. An impossible generation configuration fails
before commit with an actionable error.

**AC-04 — Complete double round robin**  
The season contains exactly 18 match weeks and 90 fixtures. Each week contains
five fixtures, each club plays exactly once per week, and every pair of clubs
meets once at each venue.

**AC-05 — Season-aware seeds**  
Replaying the same season with the same inputs is deterministic, while the
same pairing in a later season receives a different match seed.

**AC-06 — Complete paginated search**  
Walking all result cursors returns every matching player exactly once. A
matching player beyond the first 100 unfiltered rows is still returned by a
filtered query.

**AC-07 — Stable sorting and cursors**  
Every supported sort produces deterministic pages with no duplicates or
omissions, including when multiple players share the primary sort value.

**AC-08 — Truthful filters**  
Every filter exposed by the scouting/player-search UI changes the server query
and returns only matching records; no visible control is a client-side no-op.

**AC-09 — Dual-dialect parity**  
AC-01 through AC-08 pass against SQLite and Postgres without dialect-specific
feature behavior.

**AC-10 — Long-horizon foundation**  
A headless five-season run completes with 450 played fixtures, no duplicate
fixture, no invalid squad, and deterministic output for the same seed.

### Implementation evidence and remaining gaps

| AC | Audit status | Current evidence / remaining work |
|---|---|---|
| 01–03 | Partial | Focused Story 09 tests verify deterministic 10×20 generation, unique names, and the implemented positional floors. Atomic rollback and actionable impossible-configuration failure are not verified. |
| 04–05 | Verified in focused tests | Schedule coverage verifies 18 weeks, 90 fixtures, five matches per week, home/away pairing, and season-aware seeds. |
| 06 | Partial | Cursor walking reaches all 200 players, and filtered name/market targets beyond the initial page are returned. Not every proposed filter is covered. |
| 07 | Open | The complete allowlisted sorting and stable composite-cursor contract is not implemented or verified. |
| 08 | Partial | Market availability reaches the server; several scouting filters remain client-side. |
| 09 | Unverified | Both dialect branches exist, but this Story 09 contract has not been demonstrated against live Postgres. |
| 10 | Partial | A deterministic full-season characterization completes all 90 fixtures with legal real-player squads in roughly a tenth of a second. The five-season/450-fixture acceptance gate remains open. |

## 7. Red/Green Test Map

| AC | Red test written first | Green verification |
|---|---|---|
| 01–03 | `world-contract.test.ts` exposes duplicate names or roster-floor failures | deterministic world snapshot and invariant assertions pass |
| 04–05 | `full-season-contract.test.ts` expects 18/90 and season-aware seeds | pure schedule and seed tests pass |
| 06–08 | `player-search-pagination.test.ts` places the target after row 100 and exercises every UI filter | API integration plus Playwright search flow pass |
| 09 | Run the same integration suite with both `DATABASE_URL` dialects | SQLite and Postgres matrices are green |
| 10 | `ten-team-five-season.test.ts` runs the configured league and records the first invariant failure | five-season deterministic harness passes |

The PR description must include the observed failure from each new AC-numbered
test before its implementation, per repository TDD policy.

## 8. Definition of Done

- AC-01 through AC-10 pass with named verification; the table above records
  the current partial state rather than claiming this gate is complete.
- The default dev world uses the ten-team configuration from one source.
- No current test or README describes the playable foundation as 20 clubs.
- Search can reach every seeded senior player from the UI.
- SQLite and Postgres test matrices pass.
- `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm doctrine` exit 0.
- No unrelated transfer, scouting, simulation, or UI redesign lands in this
  story.

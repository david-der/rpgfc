# RPG FC — Story 05

## Tactics, Squad & Role Promise Consequences

Story 04 taught the game how to sign a player. Story 05 teaches it how
to **deploy** one — and, crucially, how to *disappoint* one. A club
picks a formation, a playing style, and a squad role for every player
on its books. When a player's assigned squad role drifts below the
role promise stored on their contract, the game surfaces an immediate
mood consequence in qualitative words. No matches yet — that's Story
06 — but the promise → rotation → mood chain becomes real here.

---

## Story Metadata

| Field | Value |
|---|---|
| Story ID | RPGFC-05 |
| Phase | Phase 3 — Decisions with Consequences |
| Estimate | 1.5 weeks solo, or ~6–10 focused Claude Code sessions |
| Depends on | RPGFC-00, RPGFC-01, RPGFC-02, RPGFC-03, RPGFC-04 |
| Blocks | RPGFC-06 (Match sim), RPGFC-08 (Meta) |
| References | PRD §4.6, §9.1, §9.2; TDD v2 §6, §18; Style Guide §6, §10 |
| Status | Ready for implementation |

---

## 1. Summary

A football manager game that never lets you pick a formation is not a
football manager game. Story 05 adds the missing half of Story 04's
transfer loop: once you own a player, you have to **slot him in** — and
the slot you pick is visible to the player. A Star Player promised on a
contract who finds himself as Rotation on the squad page earns a
"disappointed" mood chip. A Backup promised a small role who ends up
starting earns a "proud" chip. Both are qualitative; both come from
the same `rolePromise` vs `squadRole` comparison.

The tactics entity is narrow on purpose: a single formation, a single
playing style, three team-wide instructions, and a per-position slot
assignment. The squad entity is narrower still: every player on the
club's books is bucketed into one of four `SquadRole` values
(`Starter`, `Rotation`, `Backup`, `Youth`) and optionally pinned to a
specific tactics slot (GK, DC1, DC2, LB, RB, DMC, MCL, MCR, LW, RW,
ST, or one of seven BENCH slots). Harmony — a squad-level qualitative
tier — aggregates the per-player promise-vs-role deltas into a
single readable word.

### 1.1 Why this story next

Story 04 stored the role promise on every contract but deferred the
consequences. Story 05 cashes that promise in. Until there's a squad
page, the role promise is just a database column — it has no weight on
the player's experience. Story 06's match engine will use squad
assignments to pick eleven starters; Story 05 is the enabling piece
that makes that picking meaningful.

Doing it before Story 06 also lets us exercise tactics as **pure UI** —
no sim, no match-time adjustments, no half-time changes. Story 06 adds
the runtime; Story 05 nails the reading destination and the promise
consequence in isolation.

### 1.2 User value

The first moment the manager is a **coach**. Open `/tactics`, pick
`4-3-3` from a select, pick a playing style, drag nothing (selects
only for Story 05) — every slot is a dropdown over squad players.
Navigate to `/squad`, see every contracted player bucketed by role
with a qualitative harmony chip. Notice that the Star Player you
just signed in Story 04 has a **"Disappointed"** chip because you
filed him in Rotation. Move him to Starter, watch the chip flip to
**"Eager"**, feel the feedback loop close.

### 1.3 Not goals

- **No match engine.** No starting XI actually runs on a pitch yet.
  Story 06 wires simulation.
- **No pitch diagram drag-and-drop.** Every slot is a dropdown in
  Story 05. A real pitch editor can land later without changing the
  data shape.
- **No training, no mentor relationships, no youth academy.** All
  deferred — PRD §4.7 youth academy is its own story, training is
  another, mentor pairings are another.
- **No tactical familiarity decay.** PRD §9.2's "your players don't
  know this system yet" mechanic is deferred to Story 06 where match
  outcomes can feed into familiarity.
- **No set pieces.** PRD §9.3 — deferred.
- **No in-match management** (subs, role changes, half-time team
  talks). Deferred to Story 06.
- **No multiple tactics per club.** Story 05 stores exactly one
  tactics row per club. Story 06 can grow this into A/B tactics
  without re-migrating — the `tactics` table already has a `name`
  column ready for it.
- **No opposition scouting / counter-tactics.** Scouts know players,
  not rival systems. Deferred indefinitely.

---

## 2. Technical Additions

### 2.1 Shared types

```ts
// @rpgfc/shared/src/types/tactics.ts

export const FORMATIONS = [
  "4-4-2",
  "4-3-3",
  "4-2-3-1",
  "3-5-2",
  "3-4-3",
  "5-3-2",
] as const;
export type Formation = (typeof FORMATIONS)[number];

export const PLAYING_STYLES = [
  "Possession",
  "Counter-Attack",
  "High Press",
  "Direct",
  "Balanced",
] as const;
export type PlayingStyle = (typeof PLAYING_STYLES)[number];

export const TEAM_INSTRUCTIONS = [
  "PlayOutFromTheBack",
  "HighLine",
  "HighTempo",
  "WorkBallIntoBox",
  "PressHigh",
  "StayCompact",
] as const;
export type TeamInstruction = (typeof TEAM_INSTRUCTIONS)[number];

/** Eleven on-pitch slot ids, formation-agnostic so the shape stays
 *  stable if Story 06+ grows the formation catalog. Every slot is
 *  labelled so the UI can render it without a lookup table. */
export const PITCH_SLOTS = [
  "GK",
  "DC1", "DC2", "DC3",
  "LB", "RB", "LWB", "RWB",
  "DMC", "MCL", "MCR", "MCC",
  "AMC", "LW", "RW",
  "ST1", "ST2",
] as const;
export type PitchSlot = (typeof PITCH_SLOTS)[number];

export interface Tactics {
  id: number;
  clubId: number;
  name: string;               // "Default" for Story 05
  formation: Formation;
  playingStyle: PlayingStyle;
  instructions: TeamInstruction[];
  /** Which PitchSlot maps to which playerId. Only the slots used by
   *  the chosen formation carry a value; others are undefined. */
  assignments: Partial<Record<PitchSlot, number>>;
  updatedAt: string;
}
```

```ts
// @rpgfc/shared/src/types/squad.ts

export const SQUAD_ROLES = [
  "Starter",
  "Rotation",
  "Backup",
  "Youth",
] as const;
export type SquadRole = (typeof SQUAD_ROLES)[number];

export interface SquadEntry {
  id: number;
  clubId: number;
  playerId: number;
  role: SquadRole;
  updatedAt: string;
}

/** Qualitative delta between a player's contract.rolePromise and
 *  their squad role. Rendered as a mood chip on the player identity. */
export type PromiseMood =
  | "Eager"        // squad role > promise (playing above expectation)
  | "Content"      // squad role == promise
  | "Concerned"    // squad role one rung below promise
  | "Disappointed" // squad role >= two rungs below promise
  | "Furious";     // promise is "Star Player" and squad is "Youth"

/** Squad-level aggregate. `min` of every per-player mood, mapped to
 *  a tier word for display. */
export type Harmony =
  | "Harmonious"
  | "Settled"
  | "Uneasy"
  | "Fractured"
  | "InRevolt";
```

### 2.2 Rendered (wire) shapes

```ts
// @rpgfc/shared/src/types/rendered.ts  (additions)

export interface RenderedTactics {
  id: number;
  clubId: number;
  formationLabel: string;      // "4-3-3"
  playingStyleLabel: string;   // "High Press"
  instructionLabels: string[]; // ["Press High", "Play Out From the Back"]
  assignments: Array<{
    slot: PitchSlot;
    slotLabel: string;         // "LW", "MCR", "GK"
    playerId: number | null;
    playerName: string | null; // null when the slot is empty
    positionLabel: string | null;
  }>;
  updatedAt: string;
}

export interface RenderedSquadEntry {
  playerId: number;
  playerName: string;
  positionLabel: string;
  archetypeLabel: string;
  role: SquadRole;
  rolePromise: PlayingTimeRole | null; // null if the player has no contract yet
  promiseMood: PromiseMood | null;
  promiseMoodLabel: string | null;     // "Disappointed at his rotation"
}

export interface RenderedSquad {
  clubId: number;
  clubName: string;
  harmony: Harmony;
  harmonyLabel: string;     // "Settled", "On the brink"
  entries: RenderedSquadEntry[];
}
```

### 2.3 Database

New tables, both dialects:

```
tactics           id, club_id (unique per name),
                  name TEXT NOT NULL DEFAULT 'Default',
                  formation TEXT NOT NULL,
                  playing_style TEXT NOT NULL,
                  instructions_json TEXT NOT NULL,   -- JSON array
                  assignments_json TEXT NOT NULL,    -- JSON {slot: playerId}
                  updated_at TEXT NOT NULL,
                  UNIQUE(club_id, name)

squad_entries     id, club_id, player_id UNIQUE,
                  role TEXT NOT NULL,                -- Starter|Rotation|Backup|Youth
                  updated_at TEXT NOT NULL
```

No ALTERs to existing tables. No JSONB. No ARRAY. Portability scan
stays green.

### 2.4 Application layer

```
packages/server/src/application/tactics/
  repository.ts     — getTactics(clubId), upsertTactics(tactics)
  defaults.ts       — defaultTacticsFor(clubId, formation) — builds a
                      Tactics row with all slots empty for the chosen
                      formation's slot set
  assign.ts         — setAssignment(clubId, slot, playerId?) — single-
                      slot mutator that also unpins the player from any
                      other slot they previously occupied (pins are
                      unique per player, per tactics row)

packages/server/src/application/squad/
  repository.ts     — listSquad(clubId), getSquadEntry(playerId),
                      setSquadRole(playerId, role)
  seed.ts           — seedSquadForClub(clubId) — every player at a club
                      starts as Rotation, except the three oldest who
                      become Starter and the three youngest who become
                      Youth. Deterministic from player age.
  harmony.ts        — pure functions:
                      moodFor(promise, role) -> PromiseMood
                      moodLabel(mood, role, promise) -> string
                      harmonyFor(entries) -> Harmony
                      harmonyLabel(harmony) -> string
```

The `harmony.ts` module is the heart of Story 05. It's stdlib-only,
depends on nothing Drizzle-shaped, and is covered by unit tests. The
rendering layer imports it.

### 2.5 Rendering layer

```
rendering/
  tactics-response.ts  — renderTactics(clubId): RenderedTactics
                         getTacticsForClub, upsertTacticsFromInput
  squad-response.ts    — renderSquad(clubId): RenderedSquad
                         renderPromiseMoodFor(playerId) so the
                         Player Profile page can surface a mood chip
                         without round-tripping through the full
                         squad page
```

Both modules resolve player names + position labels via the same
player repository the rest of rendering/ already uses, so Story 05
doesn't introduce a second player lookup path.

### 2.6 Routes

```
GET  /api/tactics              — current tactics for the user's club
                                  (single row, auto-created on demand)
PUT  /api/tactics              — upsert formation + style + instructions
POST /api/tactics/assignments  — { slot, playerId? } — pin / unpin
GET  /api/squad                — full RenderedSquad for the user's club
PUT  /api/squad/:playerId/role — { role: SquadRole }
```

All routes stay inside the rendering boundary. The `setAssignment`
handler refuses a slot that isn't part of the current formation's slot
set, returning a 400 with a machine-readable reason.

### 2.7 UI

New routes:

- **`/tactics`** — Editor archetype. Left work area is a vertical
  stack of eleven slot rows for the active formation, each row a
  dropdown populated from the user's squad filtered to the slot's
  compatible positions. Right config panel picks formation, playing
  style, and toggles instructions. Bottom action bar is
  `[Save changes]   [Reset to default]`.
- **`/squad`** — List archetype. Filter bar up top (role filter,
  position filter, name search), main column a `SquadTable` grouping
  players by their current `SquadRole`, right inspector renders the
  Harmony chip + a breakdown of the moods contributing to it.

Updated routes:

- **`/players/$id`** — A new **Mood** row on the header next to
  Certainty. Renders `promiseMoodLabel` as a qualitative tier. No
  numbers.
- **Primary nav** grows to **Home / Players / Scouts / Transfers /
  Tactics / Squad**. Six entries. Icons: `ClipboardList` for Tactics,
  `UsersRound` for Squad.

New components:

- `SlotRow` — a single pitch-slot row: slot label, a dropdown of
  eligible players, the currently assigned player's identity preview.
  Editor archetype atom.
- `InstructionToggleList` — a right-config panel control; one chip
  per `TeamInstruction` with selected state.
- `HarmonyChip` — list-archetype inspector atom. Renders a single
  qualitative tier word from the `Harmony` enum with style-guide
  colors + italics per certainty pattern.
- `PromiseMoodChip` — the per-player mood atom used on the profile
  header and on every squad-table row.
- `SquadRoleSelect` — reused from Story 04's `PlayingTimeSelect`
  scaffolding but typed over `SquadRole` (4 values, not 5). A thin
  wrapper around a native `<select>` with style-guide styling.

### 2.8 Seed content

- `seedTacticsForClub` — runs on world gen for every seeded club.
  Every club defaults to `4-3-3`, `Balanced`, `[PressHigh, StayCompact]`,
  and **empty** assignments. The per-club squad assignment is deferred
  to the UI; the user fills it in.
- `seedSquadForClub` — runs on world gen. Every club's roster is
  bucketed into squad roles by the age-based rule above.

---

## 3. In Scope

### 3.1 Tactics persistence

Exactly one `tactics` row per club, keyed `(club_id, name='Default')`.
Mutations go through `upsertTactics`. Slot assignments are a single
JSON blob, small (≤17 entries), read and written whole. No per-slot
row — the price of portability discipline is not worth it here, and a
JSON blob keeps the "one round-trip = one saved tactic" ergonomics.

### 3.2 Assignment uniqueness per player

A player may be pinned to at most **one** slot. `setAssignment` is
transactional: clearing the slot the player currently occupies and
setting the new one happens in the same write. The invariant is
covered by a test.

Pinning a player to a slot does **not** change their `SquadRole`.
Squad role is the qualitative bucket; the pitch slot is the specific
position. A Starter can still be pinned into a rotation-dense week —
Story 06 will grow this, Story 05 keeps them decoupled.

### 3.3 Squad role bucketing

Story 05 defines four `SquadRole` values, intentionally narrower than
Story 04's five `PlayingTimeRole` values. The mapping from promise →
role is:

```
Star Player         ↔ Starter
Important Player    ↔ Starter  (no separate role tier for it)
Rotation            ↔ Rotation
Backup              ↔ Backup
Youth/Development   ↔ Youth
```

This collapses the nuance deliberately: Story 05 is about the *gap*
between promise and reality, not about a third dimension.

### 3.4 Promise mood — pure function

```ts
// application/squad/harmony.ts
function moodFor(
  promise: PlayingTimeRole | null,
  role: SquadRole,
): PromiseMood {
  if (!promise) return "Content";          // no contract, no promise
  const promisedRole = squadRoleFor(promise);
  const delta = squadRoleIndex(role) - squadRoleIndex(promisedRole);
  if (delta > 0) return "Eager";
  if (delta === 0) return "Content";
  if (delta === -1) return "Concerned";
  if (delta === -2) return "Disappointed";
  return "Furious";
}
```

Totally pure. A unit test exhausts every `(promise, role)` pair in
the 5×4 matrix, documenting the intended meaning of each cell.

### 3.5 Harmony — min-of-mood aggregate

`harmonyFor` reduces over the entries, taking the *most negative*
mood in the squad. Story 01's certainty used `min-of-max` to collapse
graded observations; Story 05 reuses the same pattern in spirit: one
furious player drags the whole squad into `InRevolt`. This is
deliberate — harmony is the canary, not the average.

```
any Furious         → InRevolt
any Disappointed    → Fractured
any Concerned       → Uneasy
all Content         → Settled
any Eager (no ↓)    → Harmonious
```

### 3.6 Mood chip on the player profile

`/players/$id` grows a "Mood" row next to Certainty. The chip renders
`promiseMoodLabel(mood, role, promise)` — a short prose template pool
in the same shape as Story 04's rejection reasons:

```
Eager         — "Exceeding the role we promised him — watch him thrive."
Content       — "Playing the role we promised."
Concerned     — "Beginning to ask whether we meant what we said."
Disappointed  — "We promised him more than Rotation. He remembers."
Furious       — "A star was promised. A youth slot is what he got."
```

Never a numeric mood score. Never a happiness percentage.

### 3.7 Nav registry

`PRIMARY_NAV` gains two entries:

```ts
{ key: "tactics", label: "Tactics", to: "/tactics", icon: ClipboardList }
{ key: "squad",   label: "Squad",   to: "/squad",   icon: UsersRound }
```

`isNavItemActive` already matches both on prefix.

### 3.8 Doctrine — promise mood is words

The doctrine suite gains one invariant for Story 05: every element
under `data-testid="player-facing"` on `/tactics`, `/squad`, and the
new Mood row on `/players/$id` must contain **no digit**, and no
currency glyph (Story 04's regex already covers the second half).

No new allowlists. Squad role labels, formation strings (`"4-3-3"`),
and playing style labels all count as chrome, not player-facing — the
`data-testid` discipline lets the formation select stay numeric
without rippling into the Playwright scrape.

---

## 4. Out of Scope

- **Match engine** — Story 06.
- **Multiple tactics per club** — later; `tactics.name` column is
  already unique-scoped to allow it.
- **Pitch-diagram drag-drop** — selects only in Story 05.
- **Tactical familiarity** — Story 06.
- **Opposition scouting** — deferred indefinitely.
- **Training, mentor pairings, youth academy** — each is its own
  later story.
- **Set pieces, in-match management** — deferred.
- **Automatic squad picks** — Story 05 is manual. Story 06's sim can
  pick from unassigned slots but Story 05 does not.

---

## 5. Acceptance Criteria

### 5.1 Shared + DB

**AC-01** — New types compile.
- **Given** the Story 05 types land.
- **When** `pnpm typecheck` runs.
- **Then** exit 0.
- **Verified by** `pnpm typecheck`.

**AC-02** — Migration `0004_tactics_squad.sql` applies on both
dialects, portability scan stays green.
- **Verified by** `packages/server/src/test/tactics-migration.test.ts`.

### 5.2 Seed + harmony math

**AC-03** — Every seeded club has exactly one `tactics` row after
world gen.
- **Verified by** `packages/server/src/test/tactics-seed.test.ts`.

**AC-04** — Every contracted player has exactly one `squad_entries`
row after world gen.
- **Verified by** `packages/server/src/test/squad-seed.test.ts`.

**AC-05** — `moodFor` is a total function.
- **Given** every `(promise, role)` pair in the `PlayingTimeRole ×
  SquadRole` product (plus the `promise=null` case).
- **When** `moodFor` is called on each.
- **Then** it returns a defined `PromiseMood` and the mapping matches
  the table in §3.4.
- **Verified by** `packages/server/src/test/harmony-mood.test.ts`.

**AC-06** — `harmonyFor` is min-of-mood.
- **Given** a squad with one `Furious` player and every other player
  `Content`.
- **When** `harmonyFor` runs.
- **Then** result is `InRevolt`.
- **Verified by** `packages/server/src/test/harmony-aggregate.test.ts`.

### 5.3 Tactics mutation

**AC-07** — Pinning a player clears any prior slot for that player.
- **Given** player 42 pinned to `LW`.
- **When** the user pins 42 to `ST1`.
- **Then** `LW` is empty and `ST1` = 42 in the same write.
- **Verified by** `packages/server/src/test/tactics-assign.test.ts`.

**AC-08** — Assigning to a slot outside the current formation's slot
set fails with a 400.
- **Given** formation `4-3-3` (no `AMC` slot).
- **When** POST `/api/tactics/assignments { slot: "AMC", playerId: 1 }`.
- **Then** response is 400 with `reason: "slot_not_in_formation"`.
- **Verified by** `packages/server/src/test/tactics-route.test.ts`.

### 5.4 Squad role wire-up

**AC-09** — A Story 04 signed `Star Player` put into Rotation shows
`Disappointed` on the profile.
- **Given** a signed player with `rolePromise="Star Player"` and
  `squadRole="Rotation"`.
- **When** `GET /api/players/:id` runs through the rendering layer.
- **Then** the response's `promiseMoodLabel` contains the
  Disappointed prose template.
- **Verified by** `packages/server/src/test/promise-mood.test.ts`.

**AC-10** — Changing a squad role updates the profile mood within
one tick.
- **Given** the scenario in AC-09.
- **When** `PUT /api/squad/:id/role { role: "Starter" }` runs.
- **Then** the subsequent `GET /api/players/:id` returns `Content`.
- **Verified by** `packages/server/src/test/promise-mood.test.ts`.

### 5.5 API

**AC-11** — `GET /api/tactics` returns `RenderedTactics` with tier
labels only.
- **Given** a freshly seeded club with empty assignments.
- **When** the client fetches `/api/tactics`.
- **Then** response has `formationLabel`, `playingStyleLabel`,
  `instructionLabels`, and an `assignments` array with all eleven
  formation slots, each with `playerId=null`.
- **Verified by** `packages/server/src/test/tactics-route.test.ts`.

**AC-12** — `GET /api/squad` returns `RenderedSquad` with harmony +
per-player mood.
- **Verified by** `packages/server/src/test/squad-route.test.ts`.

### 5.6 UI

**AC-13** — `/tactics` renders eleven slot rows for `4-3-3`.
- **Given** the seeded world.
- **When** Playwright navigates `/tactics`.
- **Then** exactly eleven `SlotRow`s render, each with a position
  label and an unfilled dropdown, and no `data-testid="player-facing"`
  element contains a digit.
- **Verified by** `tests/doctrine/tactics.spec.ts`.

**AC-14** — Changing formation re-renders the slot set.
- **Given** `/tactics` on `4-3-3`.
- **When** the user changes formation to `3-5-2`.
- **Then** the slot row set updates (no more `LW`/`RW`; new `LWB`,
  `RWB`, `AMC` appear) and unused assignments are dropped cleanly.
- **Verified by** `tests/doctrine/tactics.spec.ts`.

**AC-15** — `/squad` renders a harmony chip and per-player mood
chips with no digits.
- **Given** the seeded world where at least one Story 04 signing has
  left a promise gap.
- **When** Playwright navigates `/squad`.
- **Then** a `HarmonyChip` renders, at least one `PromiseMoodChip`
  renders a non-`Content` state, and no `data-testid="player-facing"`
  element contains a digit or currency glyph.
- **Verified by** `tests/doctrine/squad.spec.ts`.

**AC-16** — Moving a player to a different squad role flips the
harmony chip without a full page reload.
- **Given** a `Fractured` squad.
- **When** the user promotes the disappointed player to Starter via
  the `SquadRoleSelect`.
- **Then** the harmony chip advances (e.g., to `Settled`) and the
  player's mood chip reads `Content`.
- **Verified by** `tests/doctrine/squad.spec.ts`.

**AC-17** — Profile mood row appears on `/players/$id`.
- **Given** a contracted player with a promise gap.
- **When** Playwright opens the profile.
- **Then** a Mood row is visible next to Certainty, carries
  `data-testid="player-facing"`, and contains no digit.
- **Verified by** `tests/doctrine/squad.spec.ts`.

**AC-18** — Nav registry reflects Tactics and Squad and active state
resolves.
- **Given** `/` → click Tactics → click Squad.
- **When** Playwright inspects the active nav item at each step.
- **Then** the matching tab is active with `aria-current="page"`.
- **Verified by** `tests/doctrine/squad-nav.spec.ts`.

### 5.7 Doctrine

**AC-19** — Full doctrine suite still exits 0.
- **Verified by** `pnpm doctrine` in CI + locally.

---

## 6. Suggested Task Breakdown

1. **Shared types.** `Formation`, `PlayingStyle`, `TeamInstruction`,
   `PitchSlot`, `Tactics`, `SquadRole`, `SquadEntry`, `PromiseMood`,
   `Harmony`, plus `RenderedTactics`, `RenderedSquad`,
   `RenderedSquadEntry`. Export from the public barrel.
2. **Migration.** `0004_tactics_squad.sql` on both dialects.
3. **Seed.** `seedTacticsForClub`, `seedSquadForClub`. Tests: AC-03,
   AC-04.
4. **Harmony.** `moodFor`, `moodLabel`, `harmonyFor`, `harmonyLabel`.
   Unit tests for the full cross-product. Tests: AC-05, AC-06.
5. **Tactics repository + assignment mutator.** Transactional
   `setAssignment`. Test: AC-07.
6. **Squad repository.** `listSquad`, `setSquadRole`, promise-mood
   denormalization for the profile page.
7. **Rendering.** `renderTactics`, `renderSquad`,
   `renderPromiseMoodFor`. Player name lookup reuses existing repo.
8. **Routes.** `GET/PUT /api/tactics`,
   `POST /api/tactics/assignments`, `GET /api/squad`,
   `PUT /api/squad/:id/role`. Tests: AC-08, AC-11, AC-12.
9. **Player route mood wire-up.** Plumb `promiseMood` +
   `promiseMoodLabel` onto the `RenderedPlayer` shape returned by
   `/api/players/:id`. Tests: AC-09, AC-10.
10. **UI components.** `SlotRow`, `InstructionToggleList`,
    `HarmonyChip`, `PromiseMoodChip`, `SquadRoleSelect`.
11. **UI routes.** `/tactics`, `/squad`. Mood row on
    `/players/$id`.
12. **Nav entries.** Append `tactics` and `squad` to `PRIMARY_NAV`.
13. **Doctrine specs.** `tactics.spec.ts`, `squad.spec.ts`,
    `squad-nav.spec.ts`.
14. **Deliberate-violation walkthrough.** Inject `<span data-
    testid="player-facing">17 form</span>` into `/squad`, watch
    ESLint + doctrine both scream, revert, document in PR.

---

## 7. Definition of Done

- Every AC-01 through AC-19 passes.
- On a fresh `pnpm dev`, the flow: sign a Star Player on
  `/transfers/42` → navigate `/squad` → see the `Disappointed` chip
  on that player → change his role to `Starter` via the select →
  watch the chip flip to `Content` and the squad's harmony chip
  flip from `Fractured` to `Settled`. All without a page reload.
- Every element that renders player data on `/tactics`, `/squad`,
  and the new Mood row on `/players/$id` is tagged
  `data-testid="player-facing"` and survives the doctrine scrape.
- Nav has six items; all six active-state transitions work on
  deep-link refresh.
- Story 04's transfer surface is unaffected; contract signing still
  works and the rolePromise stored on the contract is what Story 05
  reads.
- `packages/web/CLAUDE.md` gains §12 "Tactics & Squad UI", and
  `packages/server/CLAUDE.md` gains §10 "Promise mood is a pure
  function" documenting the `harmony.ts` contract.
- A deliberate
  `<span data-testid="player-facing">Form 7</span>` injection into
  `/squad` is caught by **both** the ESLint rule and the doctrine
  suite.

---

## 8. Review Checklist

### 8.1 Structural

- `Tactics` / `SquadEntry` types carry raw data; `RenderedTactics` /
  `RenderedSquad` carry labels.
- Route layer only ever sees `Rendered*` shapes — `harmony.ts` +
  rendering modules are the only places `PromiseMood` is computed.
- `no-hidden-in-routes` rule stays armed.
- `setAssignment` is one transaction — never a clear-then-set pair
  that can half-land.

### 8.2 Content

- Promise mood prose pool has at least one distinct sentence per
  `PromiseMood` value. Story 05 ships five; Story 06 can grow the
  pool without changing shape.
- Harmony labels are memorable and qualitative, never "Squad harmony
  score: 72%."
- `SquadRoleSelect` uses four values only; `PlayingTimeSelect`
  (Story 04) keeps its five. The types don't leak into each other.

### 8.3 Doctrine

- `/tactics`, `/squad`, and the `/players/$id` Mood row all pass the
  no-numbers scrape with zero new allowlists.
- Formation labels like `"4-3-3"` and slot labels like `"DMC"` live on
  chrome elements, not `player-facing` ones.
- Deliberate-violation walkthrough documented in the PR description.

### 8.4 Style Guide

- `/tactics` follows the Editor archetype: left work area (slot
  rows), right Configuration panel (formation, style,
  instructions), bottom persistent action bar (Save, Reset). Never
  a floating action button.
- `/squad` follows the List archetype: filter bar, main column of
  grouped `SquadTable`, right inspector with `HarmonyChip`.
- No component introduces a new radius key or a `shadow-*` class.
- `HarmonyChip` + `PromiseMoodChip` both pair color with
  font-weight + italicization, never color alone.

---

## 9. Risks & Pitfalls

### 9.1 Harmony as a scoreboard

**Risk:** A future story adds a 0–100 harmony gauge "for debugging"
and it migrates onto the UI.

**Mitigation:** `harmonyFor` returns a `Harmony` union, not a
number. Any intermediate numeric used inside the function stays
local. The Playwright scrape on `/squad` catches any leak.

### 9.2 Slot uniqueness bug

**Risk:** `setAssignment` forgets to clear the player's prior slot
and the same player ends up pinned to two positions, breaking the
match engine's starter picker in Story 06.

**Mitigation:** AC-07 tests the invariant. The `assignments_json`
shape is small enough that `setAssignment` can validate the whole
blob on write — and does.

### 9.3 Formation change drops assignments silently

**Risk:** Switching from `4-3-3` to `3-5-2` drops `LW` + `RW`
without telling the user, and the manager opens a match wondering
why the wings are empty.

**Mitigation:** The formation-change handler returns the list of
dropped slots in its response. The UI surfaces a tier-word
confirmation: _"Three slots from your old shape no longer fit.
They have been cleared."_ No numbers, but a clear signal.

### 9.4 `SquadRole` and `PlayingTimeRole` drift

**Risk:** Two role enums with overlapping meaning grow inconsistent
naming and the promise-vs-role mapping becomes a lookup table no
one trusts.

**Mitigation:** The mapping lives in exactly one function,
`squadRoleFor(promise)`, in `harmony.ts`. A unit test pins every
value. If a new role tier lands, the test fails until the mapping
is updated deliberately.

### 9.5 Mood chip reads as clinical

**Risk:** "Disappointed" reads like a database enum, not a moment.

**Mitigation:** The prose pool. Each mood maps to a short sentence
that sounds like a scout or a press beat — same register as Story
04's rejection templates. Story 06+ can grow the pool with match-
specific variants ("A hat-trick from the bench — he is done
smiling politely").

---

## Appendix A — Sample `/squad` inspector (UI copy)

```
────────────────────────────────────────────────
  HARMONY                     [ Fractured ]
────────────────────────────────────────────────

  A star was promised.
  A youth slot is what he got.

  See: Diogo Marques (LW)
  See: Ana Figueira (ST)

────────────────────────────────────────────────
```

No percentages. No averages. A chip and two names.

## Appendix B — Sample promise mood prose pool

```
EAGER         — "Exceeding the role we promised him — watch him thrive."
CONTENT       — "Playing the role we promised."
CONCERNED     — "Beginning to ask whether we meant what we said."
DISAPPOINTED  — "We promised him more than Rotation. He remembers."
FURIOUS       — "A star was promised. A youth slot is what he got."
```

Each is ≤80 chars so it fits in a single `PromiseMoodChip` without
wrapping.

## Appendix C — Cross-story references

- **Story 04 (Transfers)** writes `contract.rolePromise` on sign.
  Story 05 reads it. No shape change to the contract row.
- **Story 06 (Match sim)** reads `tactics` + `squad_entries` to
  pick a starting XI and run a match. The `tactics.assignments`
  JSON blob is the authoritative source — Story 06 does not need
  to re-migrate it.
- **Story 07 (Save slots + seasons)** doesn't touch this story's
  shapes, but a season rollover eventually re-evaluates each
  contract's satisfaction over the whole season — Story 05's
  mood chip is the frame-level reading that Story 07's season
  reading will complement.
- **Story 08 (Rogue-lite meta)** uses `Harmony` as one of the
  per-run outcome readings surfaced on the end-of-run screen.

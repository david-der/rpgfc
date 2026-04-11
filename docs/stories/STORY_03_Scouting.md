# RPG FC — Story 03

## Scouting + Clubs Grow Up

Replace the synthetic `viewerScoutLevel` with a real knowledge graph fed by
named scout characters. Grow the Story 01 club shells into full entities
with colors, reputation, and finances — the Profile page starts to feel
themed, and every hidden fact crossing the rendering boundary now carries
a per-fact certainty derived from observation counts.

---

## Story Metadata

| Field | Value |
|---|---|
| Story ID | RPGFC-03 |
| Phase | Phase 2 — Information Economy |
| Estimate | 2–3 weeks solo, or ~10–14 focused Claude Code sessions |
| Depends on | RPGFC-00, RPGFC-01, RPGFC-02 |
| Blocks | RPGFC-04 (Transfers), RPGFC-05 (Tactics), RPGFC-06 (Sim) |
| References | PRD §2.4, §3.2, §4, §5.8, §7, §11; TDD v2 §6.1, §6.3, §18.3; Style Guide §2.6, §3, §6 |
| Status | Ready for implementation |

---

## 1. Summary

PRD Pillar Four: **Information has cost.** Story 01 faked that pillar with
a single `viewerScoutLevel` integer that uniformly decided certainty for
every fact on every player. Story 03 makes it real. Named scouts observe
specific players and specific regions. Each observation lands in a
knowledge graph as a (subject, fact, source, certainty, timestamp) node.
When the UI renders a player profile, it reads the graph — not the hidden
attributes — and the same player legitimately looks different to the
manager depending on who has watched him and for how long.

At the same time, Story 01's club shells (just a name and a nationality)
grow into real entities: colors, finances, reputation tiers, regional
context. The Profile archetype's club-stripe finally means something.

### 1.1 Why this story next

Every later story needs this. Transfers (Story 04) depend on knowing who
a player is in enough detail to negotiate. Tactics (Story 05) need to know
which players fit a role, which is a function of observed traits. Sim
(Story 06) needs real clubs with real spending power to produce match
contexts that matter. Story 03 is the story that makes the world feel
populated and fallible — until now, every player was either fully known
(Confident) or fully unknown, which is neither how scouting works nor
how the PRD wants it to work.

### 1.2 User value

The first moment a profile looks **different** depending on who the
viewer is. A star player who has been at the club for years renders
with Certain-tier prose across the board; a prospect just linked in the
media renders in Speculation italics with one Likely badge. Open the
Scouts page and two named scouts — "Henri, European specialist" and
"Cristina, scouts South America cheaply" — sit there with recent
observations. Send Henri to watch a Porto winger for a week; come back
and the winger's certainty tier has climbed a notch.

### 1.3 Not goals

- **No AI scouting competition.** Story 03 is about the manager's own
  scout network. Rival clubs' scouts are a later story.
- **No scout hiring market.** The scout pool is seeded at world
  generation. Hiring and firing scouts is a later story (probably
  part of the broader Staff system).
- **No opponent analysis briefings.** That assignment type in PRD §7.3
  only matters once matches exist (Story 06). Story 03 ships Regional
  Watch and Player Focus only.
- **No per-fact decay.** The graph stores an `observed_at` but knowledge
  doesn't degrade yet — that's a Story 03+ balance exercise.
- **No prose generation from the graph.** The existing identity/form
  prose generators keep running on hidden state via the rendering layer;
  Story 03 changes the **certainty** of their output but not their
  template shapes. Scout reports are a separate output surface.
- **No club theming colors beyond the six CSS variables.** Story 03
  lights those variables up from real club records — Profile pages get
  themed — but fans, merchandise, and kit variations are later stories.

---

## 2. Technical Additions

### 2.1 Shared types

```ts
// @rpgfc/shared/src/types/scout.ts
export type ScoutRegion = "Iberia" | "BeneluxFrance" | "SouthAmerica" | "Europe" | "Global";

export interface ScoutVoice {
  /** Stable id used for template lookup. */
  id: string;
  /** Short descriptive name for the dev/prod UI ("dry and precise"). */
  description: string;
}

export interface ScoutRef {
  id: number;
  runId: number;
  name: string;
  region: ScoutRegion;
  voice: ScoutVoice;
  /** Tier word from the trust ramp — not a number. */
  trust: "New" | "Trusted" | "Veteran";
}

// @rpgfc/shared/src/types/knowledge.ts
export type FactType =
  | "natural_gift_tier"   // pace, finishing, composure, ...
  | "mental_trait_tier"   // ambition, leadership, ...
  | "badge_presence"       // badge key known / unknown
  | "club_id"
  | "position_label";

export interface KnowledgeNodeRef {
  subject: { kind: "player"; id: number };
  factType: FactType;
  factKey: string;        // e.g. "pace", "clutch_finisher"
  certainty: CertaintyTier;
  observedAt: string;     // ISO-8601
  sourceScoutId: number | null;
}
```

`RenderedPlayer` gains a `scoutReports: ScoutReportRef[]` field carrying
recent per-scout prose. No existing callers break — the field is new.

The club shape expands too:

```ts
export interface RenderedClubRef {
  id: number;
  name: string;
  colors: {
    primary: string;     // hex, post-clamp (Style Guide §3.2)
    secondary: string;
    stripe: string;
    primaryInk: string;
    secondaryInk: string;
  };
  reputation: "Local" | "Regional" | "National" | "Continental" | "Elite";
  nationality: string;
}
```

### 2.2 Database schema

New tables, both dialects:

```
scouts                 id, run_id, name, region, voice_id, trust_tier, hired_at
scout_assignments      id, scout_id, kind ("region"|"player"),
                       target_region, target_player_id, started_at, ended_at
scout_reports          id, scout_id, player_id, prose_body, certainty_level,
                       created_at, assignment_id
knowledge_nodes        id, run_id, subject_kind, subject_id, fact_type,
                       fact_key, fact_value_tier, certainty, observed_at,
                       source_scout_id
club_identity_ext      club_id (unique FK), primary_color, secondary_color,
                       stripe_color, reputation_tier, wage_budget_tier
```

Keep it portable: color columns are `TEXT` hex strings, no JSONB, no
ARRAY, no ENUM. All timestamps are ISO-8601 TEXT.

### 2.3 Application layer

```
packages/server/src/application/scouting/
  assignments.ts   — start/stop, list active, one-active-per-scout rule
  observations.ts  — compute a scout's weekly observations and write
                     knowledge_nodes rows
  reports.ts       — generate a prose report from recent observations
                     in the scout's voice
  seed-scouts.ts   — run-scoped seed of ~4 named scouts on world gen

packages/server/src/application/clubs/
  seed-identity.ts — deterministic color + reputation + budget per club
                     on world gen; clamped palettes per Style Guide §3.4
```

### 2.4 Rendering layer

`computeCertainty` no longer reads from `ctx.viewerScoutLevel`. It reads
from the knowledge graph: given a player and a fact, look up the latest
observation; return its certainty tier. The function signature stays the
same — `computeCertainty(hidden, ctx)` — so every caller keeps working.

New rendering functions:

```
rendering/
  club.ts              — renderClub(hidden, ctx): RenderedClubRef including colors
  knowledge.ts         — knowPlayer(playerId, ctx): Map<FactType, Observation>
  prose/scout-voice.ts — generate a prose scout report in one of 3 voices
```

### 2.5 Routes

```
GET  /api/scouts                      list the run's named scouts
GET  /api/scouts/:id                  profile + recent observations
POST /api/scouts/:id/assignments      start a new assignment
GET  /api/players/:id/reports         scout reports for a specific player
POST /api/world/observation-tick      advance the world by one observation
                                       cycle (dev-only shortcut until Story 07
                                       wires the real calendar)
```

### 2.6 UI

New routes:

- `/scouts` — **List archetype**. Each row is a new `ScoutCard` showing
  the scout's name, region, trust tier, and most recent observation
  headline.
- `/scouts/$id` — **Profile archetype**. Scout's voice, region, recent
  observations timeline, current assignment, and a button to start a
  new assignment.

Updated routes:

- `/players/$id` — the **Reports** tab (currently stubbed) now renders a
  `NarrativeBlock` per recent scout report, each in the originating
  scout's voice. The hero's overall `CertaintyText` (FIX-06) pulls from
  the aggregated knowledge graph certainty, not `viewerScoutLevel=3`.
- `/` — the primary nav grows to three entries: **Home**, **Players**,
  **Scouts**.

New components:

- `ScoutCard` — list item, same weight class as `PlayerIdentityCard`
- `ScoutReportCard` — a single prose report in a scout's voice, with
  the scout's name, the date, and the originating assignment as the
  eyebrow
- `AssignmentPicker` — Editor-archetype panel for starting a new
  assignment

### 2.7 Seed content

- **3 seed scouts per run**, one per region covered by the Story 01 name
  pools (Iberia, Benelux, South America). Each with a handcrafted voice
  template.
- **Club identity seeded per club** at world generation. Colors are
  picked deterministically from a palette of ~12 clamped hex pairs;
  club name drives the seed so "Club Madrid" always ends up with the
  same colors across worlds with the same seed.
- **3 scout voices** — "dry and precise", "warm and effusive", "terse
  and cautious". Prose generator injects the voice id into its
  template selection.

---

## 3. In Scope

### 3.1 Clubs grow up

Every club record gains:

- `primary_color`, `secondary_color`, `stripe_color` (TEXT hex).
- `reputation_tier` (five-tier qualitative ramp).
- `wage_budget_tier` (five-tier qualitative ramp — no numeric budget yet;
  Story 04 makes it real).

Seed logic picks colors from a clamped palette per Style Guide §3.4:
no near-white, no neon, no pure red/blue. A `color-safety.test.ts`
asserts every seeded club's `(color, parchment-50)` pair clears WCAG AA
4.5:1 contrast.

The Profile page wires `--club-primary` / `--club-stripe` from the
fetched club. Profiles now actually read as **themed**.

### 3.2 Scouts as characters

Four seed scouts land per run — one per regional name pool plus a
generalist. Each is a row in the `scouts` table with a `voice_id`.
They cannot be hired, fired, or promoted in Story 03. They are static
staff.

Every scout has exactly one active assignment at a time. Starting a
new assignment ends the previous one.

### 3.3 Knowledge graph

The canonical data structure replacing `viewerScoutLevel`.

```
knowledge_nodes
  id
  run_id
  subject_kind (TEXT: "player" | "club" | future kinds)
  subject_id
  fact_type (TEXT: see §2.1 FactType union)
  fact_key (TEXT: e.g. "pace", "clutch_finisher")
  fact_value_tier (TEXT: the tier word OR badge presence flag)
  certainty (TEXT: CertaintyTier)
  observed_at (TEXT ISO-8601)
  source_scout_id (INTEGER nullable)
```

The rendering layer's `computeCertainty(hidden, ctx)` now:

1. Queries `knowledge_nodes` for the player's facts.
2. Aggregates the **overall** player certainty as the minimum of the
   max-per-fact-type certainties (a player is only as Certain as its
   worst-known dimension).
3. Returns that tier to the rendered output.

Badge-level certainty (`BadgeRef.certainty`) is computed per-badge from
the same table: if the knowledge graph has observed `badge_presence`
for that key, use the stored certainty; otherwise fall back to
`Unknown`.

### 3.4 Scout assignments and observations

Two assignment kinds ship in Story 03:

- **Regional Watch** — the scout roams a region producing low-certainty
  observations on random unlisted players over the course of the
  assignment. Weekly tick: produce N observations where N is drawn
  from the scout's trust tier.
- **Player Focus** — the scout watches a specific player. Weekly tick:
  produce K observations for that player, climbing the certainty ladder
  (Unknown → Speculation → Likely → Confident → Certain). Once Certain
  is reached, the assignment auto-ends.

The observation tick is a new server endpoint:

```
POST /api/world/observation-tick
```

Dev-only. Called manually from the dev UI or a button on the Scouts
page. Story 07 wires this into the real seasonal calendar; Story 03
keeps it as a manual lever so the information economy can be exercised
without the calendar.

### 3.5 Scout reports

When an assignment produces observations, it also produces a **report**:
a short prose paragraph in the scout's voice referencing the new
observations. Reports are stored in the `scout_reports` table and
surfaced on:

- The scout's own `/scouts/$id` profile (most recent first).
- The target player's Reports tab on `/players/$id` (filtered to that
  player, most recent first).

Prose generation uses voice-specific templates. A "dry and precise"
scout writes `"Watched him twice this week. The pace is real — call it
rapid. The finishing still looks honest."` A "warm and effusive" scout
writes `"Magical afternoon at the training ground — what a player. His
pace is properly electric and he finishes like a clinical veteran."`

### 3.6 Scout disagreement surfacing

Light version: when two scouts' latest observations for the same fact
produce different tier words, the player's Reports tab renders a
small "Differences" callout at the top of the tab listing the
disagreements. Example:

> **Henri** calls the pace _rapid_. **Cristina** calls it _quick_.

A unit test asserts the callout renders only when such a mismatch
exists on the latest per-scout observation.

### 3.7 UI deliverables

- **ScoutCard** — List archetype item for the `/scouts` page.
- **ScoutReportCard** — styled reading card, serif body, left border
  `--club-secondary`, eyebrow = scout name + date + assignment kind.
- **AssignmentPicker** — Editor panel. Region / Player radio, target
  selector, Start button.
- `/scouts` route — List archetype, iterates `ScoutCard`.
- `/scouts/$id` route — Profile archetype, TabBar with Overview / Recent
  Reports / Assignments. Overview tab wired; others stubbed like
  Story 01 did for the player Profile.
- Primary nav grows: **Home / Players / Scouts**. Single line in
  `lib/navigation.ts`.
- Player Profile **Reports** tab wires up for the first time.
- Player Profile hero certainty line (FIX-06) reads from aggregated
  knowledge-graph certainty.

### 3.8 Doctrine extensions

- No new doctrine gates. The existing four continue to apply:
  - Scout reports are prose — they **can** contain numbers in cases
    like "Watched him **twice** this week" as long as they are not
    inside `data-testid="player-facing"`. Wrap the body in a
    `NarrativeBlock` (non-player-facing) — the reports are editorial
    output, not raw player facts.
  - `data-testid="player-facing"` continues to mark raw rendering-layer
    output on profile facts and badges; those remain digit-free.
- `tests/doctrine/scouts.spec.ts` — new spec walks `/scouts` and
  `/scouts/$id`, asserts the nav shell carries a Scouts entry, and
  confirms no `player-facing` element on either route carries a digit.
- `tests/doctrine/player-profile-reports.spec.ts` — new spec confirms
  the Reports tab renders ≥1 `ScoutReportCard` after a player-focus
  observation tick.

---

## 4. Out of Scope

- **AI-driven scouting by rival clubs.** No opposing networks, no
  hidden market events.
- **Opponent analysis briefings.** No matches exist yet.
- **Knowledge decay.** Observations don't stale out over time.
- **Scout hiring market.** The pool is fixed at world gen.
- **Scout-badge chemistry.** Per PRD §7.2, scouts have their own badges
  ("Eye for a Playmaker"). Story 03 seeds a single tier badge per
  scout as flavor but does not wire badge effects into observations.
- **Multi-run scout continuity.** Each run starts with fresh seeds.
  Legacy scout contacts land with Story 08.

---

## 5. Acceptance Criteria

### 5.1 Shared types + schema

**AC-01** — New types compile across the workspace with the existing
branded-type discipline untouched.
- **Given** `@rpgfc/shared` after Story 03 types land.
- **When** `pnpm typecheck` runs.
- **Then** exit 0. `HiddenPlayer` / `RenderedPlayer` brands continue
  to refuse structural assignment. `WirePlayer` gains `scoutReports`
  safely.
- **Verified by** `pnpm typecheck`.

**AC-02** — Migration `0002_scouting.sql` applies cleanly on both
dialects.
- **Given** a fresh DB.
- **When** the migration runner executes.
- **Then** `scouts`, `scout_assignments`, `scout_reports`,
  `knowledge_nodes`, `club_identity_ext` all exist with FKs and the
  Story 00/01 portability scan still passes.
- **Verified by** `packages/server/src/test/scouting-migration.test.ts`.

### 5.2 Club identity

**AC-03** — Every seeded club carries a contrast-safe color pair.
- **Given** `generateWorld(seed=42, clubCount=10)` after the content
  seed step.
- **When** each club's primary/stripe/parchment-50 contrast is
  computed.
- **Then** every ratio clears WCAG AA (4.5:1 for normal text, 3:1 for
  large text).
- **Verified by** `packages/server/src/test/club-color-safety.test.ts`.

**AC-04** — The Profile page applies the player's club colors to
`--club-primary` / `--club-stripe`.
- **Given** `/players/1` (Iván Fernández, Club Madrid).
- **When** Playwright inspects the root document's computed style.
- **Then** `--club-primary` evaluates to Club Madrid's seeded primary
  hex. The 2px club-stripe at the top of the AppShell evaluates to
  the seeded stripe color.
- **Verified by** `tests/doctrine/club-theming.spec.ts`.

### 5.3 Knowledge graph

**AC-05** — The graph replaces `viewerScoutLevel` as the source of
certainty.
- **Given** a freshly-seeded world with no observations recorded.
- **When** the Profile page for player id 1 renders.
- **Then** overall `certainty` is **Unknown** or **Speculation** and
  every `BadgeRef.certainty` is **Unknown**, regardless of
  `viewerScoutLevel`.
- **Verified by** `packages/server/src/test/knowledge-default.test.ts`
  and a Playwright cross-check on the rendered profile.

**AC-06** — Player Focus observations raise certainty deterministically.
- **Given** a scout assigned Player Focus on player id 1 and a world
  seed that pins the observation RNG.
- **When** three observation ticks fire.
- **Then** the player's overall certainty has climbed by exactly three
  tiers on the ladder (up to **Certain**).
- **Verified by** `packages/server/src/test/observation-ladder.test.ts`.

**AC-07** — Two scouts observing the same player can disagree.
- **Given** two scouts whose seeded observation RNGs roll different
  tier words for the same fact.
- **When** both produce observations on player id 1.
- **Then** the player's Reports tab includes a "Differences" callout
  listing at least one disagreement.
- **Verified by** `packages/web/src/test/components/ScoutDisagreement.test.tsx`
  + a Playwright check on a fixture-seeded pair.

### 5.4 Scouts & assignments

**AC-08** — Four seed scouts land on world gen.
- **Given** `generateWorld(seed=42)`.
- **When** the scouts table is queried.
- **Then** exactly 4 named scouts exist, one per region (Iberia,
  Benelux, South America, Global).
- **Verified by** `packages/server/src/test/scout-seed.test.ts`.

**AC-09** — Only one assignment is active per scout at a time.
- **Given** a scout with an active Player Focus.
- **When** `POST /api/scouts/:id/assignments` starts a Regional Watch.
- **Then** the previous assignment's `ended_at` is stamped, the new
  assignment is the only active one for that scout, and an observation
  tick on the scout produces observations for the new region only.
- **Verified by** `packages/server/src/test/assignment-exclusivity.test.ts`.

**AC-10** — Regional Watch produces observations across multiple
players in the target region.
- **Given** a scout running Regional Watch on Iberia.
- **When** one observation tick fires.
- **Then** between 2 and 6 new `knowledge_nodes` rows exist against
  Iberian players (nationality = ES), none against other regions.
- **Verified by** `packages/server/src/test/regional-watch.test.ts`.

### 5.5 API

**AC-11** — `GET /api/scouts` returns every run-scoped scout shape as
`ScoutRef`.
- **Given** the seeded run.
- **When** the client calls `api.api.scouts.$get()`.
- **Then** the response is 200 with 4 items, each carrying name,
  region, voice, and trust tier.
- **Verified by** `packages/server/src/test/scouts-route.test.ts`.

**AC-12** — `GET /api/players/:id/reports` returns recent scout reports.
- **Given** a player with at least 2 recent Player Focus observations.
- **When** the client fetches `/api/players/1/reports`.
- **Then** the response contains ≥2 `ScoutReportRef` items ordered most
  recent first, each carrying scout name, prose body, and date.
- **Verified by** `packages/server/src/test/player-reports-route.test.ts`.

**AC-13** — `POST /api/world/observation-tick` is dev-only.
- **Given** `AUTH_MODE=cognito`.
- **When** the endpoint is called.
- **Then** response 404.
- **Verified by** `packages/server/src/test/observation-tick-route.test.ts`.

### 5.6 UI

**AC-14** — `/scouts` is reachable from the primary nav and lists all
seeded scouts.
- **Given** `/`.
- **When** Playwright clicks the **Scouts** nav entry.
- **Then** the URL is `/scouts`, the active nav is Scouts, and 4
  `ScoutCard` items are visible.
- **Verified by** `tests/doctrine/scouts.spec.ts`.

**AC-15** — `/scouts/$id` Profile archetype composes the expected shape.
- **Given** `/scouts/1`.
- **When** Playwright navigates there.
- **Then**: serif h1 name, voice-description eyebrow, TabBar with
  Overview / Recent Reports / Assignments, Overview active, no
  `data-testid="player-facing"` digit leaks.
- **Verified by** `tests/doctrine/scouts.spec.ts`.

**AC-16** — The player Profile's **Reports** tab renders a
`NarrativeBlock` per scout report.
- **Given** a fixture with 3 seeded reports against player 1.
- **When** Playwright navigates `/players/1` and clicks **Reports**.
- **Then** ≥3 `NarrativeBlock` items are visible, each containing a
  prose paragraph. No digit leaks.
- **Verified by** `tests/doctrine/player-profile-reports.spec.ts`.

**AC-17** — Starting a Player Focus from the UI changes the scout's
active assignment.
- **Given** `/scouts/1` with the scout currently on Regional Watch.
- **When** the user picks "Player Focus" → player 1 in the
  `AssignmentPicker` and clicks Start.
- **Then** the Current Assignment panel updates to show "Player Focus:
  Iván Fernández" and a subsequent observation tick produces
  Player-Focus-style observations (≥3 node rows for player 1).
- **Verified by** a Playwright flow + backend assertion.

### 5.7 Doctrine

**AC-18** — The full doctrine suite still exits 0.
- **Given** Story 00 + Story 01 + FIX-01 + Story 02 + Story 03.
- **When** `pnpm doctrine` runs.
- **Then** every spec green. Inject `<span data-testid="player-facing">
  Rating 84</span>` into any new route and the suite fails. Revert.
- **Verified by** `pnpm doctrine` + manual walkthrough.

---

## 6. Suggested Task Breakdown

1. **Shared types.** Scout, ScoutVoice, ScoutRegion, KnowledgeNodeRef,
   FactType, expanded RenderedClubRef, ScoutReportRef. Update the
   public barrel. Add a brand-distinctness guard for any new branded
   types (none currently, but the discipline holds).
2. **DB migration.** `0002_scouting.sql` for both dialects. Hand-written
   per Story 00 convention.
3. **Seed content.** Club identity seed (deterministic palette),
   scout seed (4 named scouts per run), scout voice seed (3 voices).
4. **Color safety test.** AC-03.
5. **Rendering layer refactor.** `computeCertainty` reads from
   `knowledge_nodes`. `knowPlayer(id, ctx)` helper. Existing rendering
   tests should continue to pass; update expectations that used the
   old synthetic tier.
6. **Application: scouting services.** `startAssignment`, `endAssignment`,
   `runObservationTick`, `generateReport`.
7. **Application: clubs services.** `renderClub` pulls the expanded
   `club_identity_ext` fields.
8. **Routes.** `/api/scouts`, `/api/scouts/:id`, `/api/players/:id/reports`,
   `/api/world/observation-tick` behind dev guard.
9. **UI components.** `ScoutCard`, `ScoutReportCard`, `AssignmentPicker`.
10. **UI routes.** `/scouts`, `/scouts/$id`, Reports tab wiring on
    `/players/$id`.
11. **Nav registry.** Append `{ key: "scouts", label: "Scouts", ... }`
    to `PRIMARY_NAV`.
12. **Doctrine specs.** `scouts.spec.ts`,
    `player-profile-reports.spec.ts`, `club-theming.spec.ts`.
13. **Dev experience.** `/scouts/$id` gains a "Run observation tick"
    button that calls `/api/world/observation-tick` so the information
    economy can be exercised by a click.

---

## 7. Definition of Done

- AC-01 through AC-18 pass their named verifications.
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm doctrine` exit
  0 locally and in CI.
- A fresh `pnpm dev` → `/scouts/1` → "Run observation tick" → back to
  `/players/1` visibly climbs the player's certainty tier without a
  full page reload or a server restart.
- The nav has three items. Deep-linking `/scouts/2` highlights
  **Scouts** immediately (re-verified AC-08 behavior from Story 02
  under the new route tree).
- The Profile page's club-stripe and hero accents pick up the club's
  seeded colors.
- A deliberate number-leak on any new route fails both the ESLint
  rule and the doctrine suite.
- No regression on any of the 21 existing Playwright specs from
  Stories 00 / 01 / FIX / 02.
- Documentation: `packages/web/CLAUDE.md` gains a short §10
  "Scouting UI" noting the Reports tab / ScoutReportCard conventions;
  `packages/server/CLAUDE.md` gains a §8 "Knowledge graph" describing
  the new table and the computeCertainty contract.

---

## 8. Review Checklist

### 8.1 Structural

- `computeCertainty` is the single place `viewerScoutLevel` used to
  live and now reads from the graph. Grep proves it.
- No route file imports from the knowledge module directly; only the
  rendering layer touches it.
- `no-hidden-in-routes` ESLint rule continues to fire on its fixture.

### 8.2 Content

- 4 scouts seed per run. Each has a voice, a region, and a handcrafted
  backstory paragraph.
- ≥3 voice templates each producing a distinct voice.
- Club palette is clamped per Style Guide §3.4 — no near-white, no
  neon, no pure red/blue. Contrast-safety test enforces this.

### 8.3 Doctrine + doctrine allowlists

- Scout report prose lives in `NarrativeBlock` (editorial); the
  player-facing facts row on the profile stays digit-free.
- Any new numeric display on scout profiles uses `KeyNumber` with an
  explicit `allowlistReason`. No freestyle `<span>23</span>`.
- Nav labels are still UI chrome; no `player-facing` inside
  `/scouts` chrome.

### 8.4 Style Guide

- `ScoutReportCard` uses Style Guide §4.4 prose styles (Newsreader,
  text-lg, leading-relaxed, max-w-prose).
- Club theming honors the six CSS variables; the rest of the palette
  is untouched.
- Zero radius, zero shadow, Inter on UI, mono on numerics.

---

## 9. Risks & Pitfalls

### 9.1 Graph schema ossification

**Risk:** The `knowledge_nodes` schema is the first graph-shaped table
in the repo. Getting the shape wrong now means painful migrations
later when scout voice tuning, per-fact decay, or opponent analysis
arrive.

**Mitigation:** Story 03's schema is intentionally narrow — only the
fact types the rendering layer needs today. Anything else
(observation weights, cross-fact coupling, decay decay) waits for a
later story. Comment every column in the migration file explaining
which story it lands for.

### 9.2 Per-fact certainty slower than scalar

**Risk:** Before Story 03, `computeCertainty` was O(1) against an
integer. After: a graph lookup per player plus per badge. On a
seeded 200-player list this could visibly slow the list endpoint.

**Mitigation:** The graph lookup goes through a `Map<playerId,
Observation[]>` preloaded per request in the rendering-layer
orchestrator (same pattern as `loadClubMap`). Story 03's list
endpoint measures and must stay under the 100ms p95 read budget
from TDD v2 §19.

### 9.3 Color safety regressions

**Risk:** A palette change or an over-eager contrast clamp makes
some clubs unreadable.

**Mitigation:** AC-03 is a unit test over every seeded club, not a
visual spot check. Adding a new club with a bad palette breaks CI.

### 9.4 Voice templates read as repetitive

**Risk:** 3 voices × N players × weekly observations = a lot of prose
from a small template pool. Reports feel mechanical after a dozen.

**Mitigation:** Each voice template carries ≥5 sentence shapes. A
fallback "catch-all" template exists for edge cases. A future story
can swap the template pool for an LLM call; the interface stays the
same.

### 9.5 Regional Watch vs archetype distribution

**Risk:** If Regional Watch picks uniformly at random, a scout in
Iberia might only ever surface `pressing_forward` players because
the archetype pool is uniform. The information economy becomes
uninteresting.

**Mitigation:** Weighted sampling by "interesting-ness" — prefer
players with at least one rare inborn badge, or players whose hidden
attributes are in the top-25% of any gift. This is a simple weight
function; tune in a follow-up if the feel is wrong.

### 9.6 Dev-only observation tick couples to seasons

**Risk:** Story 03's manual tick button works until Story 07 ships
the real calendar, at which point two tick paths exist. Consumers
may accidentally ship the manual one to prod.

**Mitigation:** The dev-only tick endpoint is gated on
`AUTH_MODE=dev` exactly like `POST /api/players/generate`. Same
pattern, same enforcement. The dev button on `/scouts/$id` is
conditionally rendered behind a `import.meta.env.DEV` check.

---

## Appendix A — Example scout voice template

```
// voice_id = "dry_precise"
const DRY_PRECISE_SHAPES = [
  "Watched {name} twice this week. {gift_obs}. The {weakness_fact} still looks {weakness_tier}.",
  "{name} — three sessions, two matches. Pace is real. {positional_obs}.",
  "Call me cautious on {name}, but the {strength_fact} is the real thing — {strength_tier} by any honest measure.",
  "{name}: good technical discipline, {gift_obs_short}. Not enough {weakness_tier} work for me yet.",
  "Quiet profile: {name} is {strength_tier} on {strength_fact} and nothing else I can confirm.",
];
```

## Appendix B — Example seeded scouts

```
name: "Henri Lavigne",       region: "BeneluxFrance", voice: "dry_precise",
name: "Cristina Romero",     region: "Iberia",         voice: "warm_effusive",
name: "Paulo Nascimento",    region: "SouthAmerica",   voice: "terse_cautious",
name: "Gabrielle Okonkwo",   region: "Global",         voice: "dry_precise",
```

## Appendix C — Cross-story references

- **Story 04 (Transfers)** consumes `RenderedClubRef.colors` and
  `RenderedClubRef.wage_budget_tier`. The transfer market hub needs
  real club identity.
- **Story 05 (Tactics)** consumes the knowledge graph — fitting a
  player into a role depends on what the manager currently knows
  about him.
- **Story 06 (Sim)** writes back into the knowledge graph from match
  events (a goal is a Certain observation of the scoring player's
  finishing in that specific context).
- **Story 08 (Rogue-lite meta)** persists scout contacts across runs
  as Legacy unlocks.

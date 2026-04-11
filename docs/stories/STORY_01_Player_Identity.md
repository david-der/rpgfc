# RPG FC — Story 01

## Player Identity, End-to-End

Land the first real content on the walking skeleton. A generated player crosses
every layer of the stack — DB → application → rendering → API → SPA — and the
Profile and List archetypes from the Style Guide become real screens. Zero
numbers reach the DOM on either new page. The rendering boundary, the badge
taxonomy, and the prose pipeline all become concrete for the first time.

---

## Story Metadata

| Field | Value |
|---|---|
| Story ID | RPGFC-01 |
| Phase | Phase 1 — First Vertical Slice |
| Estimate | 2–3 weeks solo, or ~10–14 focused Claude Code sessions |
| Depends on | RPGFC-00 |
| Blocks | RPGFC-02 (Navigation), RPGFC-03 (Scouting), RPGFC-04 (Transfers) |
| References | PRD §4, §5, §6, §7; TDD v2 §6, §7, §8; Style Guide §6, §10, §13; Story 00 §3.6 doctrine gates |
| Status | Ready for implementation |

---

## 1. Summary

Story 00 proved the stack works. Story 01 proves the **product thesis** works —
that a player can be a named, badge-decorated, prose-described footballer on
the player's screen without a single number leaking through the rendering
boundary.

The story adds the full four-layer player model, the first ~30 seed badges
across every category, ~20 archetypes for generation, a deterministic seeded
generation pipeline, the first real rendering functions, two API endpoints,
and two pages — all composing Style Guide components and enforcing the
no-numbers doctrine end-to-end.

### 1.1 Why this story next

Every story that follows (scouting, transfers, squad management) is a mutation
on top of a player. Until the player model is real and renderable, every
subsequent feature is blocked on it. Story 00 could not materialize the player
without tripping over content decisions; Story 01 is where those content
decisions get made.

### 1.2 User value

The first moment the game **shows you a player**, not a test harness. A fresh
clone plus one `pnpm dev` plus one navigation click produces a profile page
that reads like a scouting dossier: a one-line identity summary in Newsreader,
a badge stack grouped by category, a prose paragraph describing who this
footballer is. No OVR. No attribute bar. No number anywhere except the
allowlisted age.

### 1.3 Not goals

- **No scout characters, no named scouts, no scout voices.** Certainty is
  derived from a single synthetic `viewerScoutLevel` passed on every request.
  Story 02 or 03 adds the real scouting system.
- **No transfer market, no contracts, no negotiations.** Players exist; they
  don't move. Story 04+.
- **No match simulation.** The sim stub ships in Story 06; Story 01 doesn't
  call it.
- **No tactics, training, squad rotation, or harmony.** Later.
- **No run lifecycle.** Players belong to a hardcoded `runId = 1` default.
  Full rogue-lite meta ships in Story 08.
- **No LLM prose generation.** Story 01 uses deterministic templates. LLM
  gating is a follow-up story.
- **No full badge library.** Story 01 ships a curated ~30 badges that exercise
  every category and every effect type; the full library grows over many
  stories.
- **No full club theming.** The CSS variables are already in place; Story 01
  leaves `--club-primary` / `--club-secondary` at their moss/clay defaults.

---

## 2. Technical Additions This Story Establishes

Story 00 is the stack baseline. Story 01 adds:

### 2.1 Data layer

- Drizzle schemas (both dialects) for `players`, `clubs`, `badges`,
  `player_badges`, `archetypes`, `thesaurus`.
- Migrations `0001_player_identity.sql` per dialect.
- JSON seed records for archetypes, badge definitions, thesaurus tier words.

### 2.2 Domain types (`@rpgfc/shared`)

- `HiddenPlayer` gains `hiddenAttrs` (pace, finishing, composure, aerial,
  tackling, passing, vision, stamina, strength, reflexes), `mentalTraits`
  (composure, ambition, leadership, temperament, workEthic, sociability,
  riskTolerance, professionalism), `nationality`, `preferredFoot`,
  `narrativeSeed`, `archetypeId`, `experienceYears`, `dob`.
- `RenderedPlayer` gains `age`, `prose.identity`, `prose.currentForm`,
  `experience: ExperienceTier`, `nationality`, `preferredFoot`,
  `positionLabel`, `club: { id, name } | null`.
- New types: `BadgeDefinition`, `BadgeTier`, `BadgeEffect`, `Archetype`,
  `ThesaurusEntry`, `NaturalGiftAttribute`, `MentalTraitKey`,
  `ExperienceTier`.

### 2.3 Generation pipeline (`@rpgfc/server/src/application/generation/`)

- `seededRng(seed)` — mulberry32 or similar deterministic PRNG.
- `generatePlayer(ctx)` — pipeline from PRD §6.1.
- `generateWorld(seed, size)` — seeds `runs`, `clubs`, and N players
  deterministically.

### 2.4 Rendering layer (`@rpgfc/server/src/rendering/`)

- `renderPlayer(hidden, ctx): RenderedPlayer` — the first real function. Only
  code permitted to read `hiddenAttrs`.
- `resolveBadges(hidden, ctx): BadgeRef[]` — badge ID lookup + per-badge
  certainty masking.
- `generateIdentityProse(hidden, badges, certainty): string` — template-based,
  deterministic.
- `generateFormProse(hidden, ctx): string` — one sentence on current form.
- `computeCertainty(hidden, ctx): CertaintyTier` — single function; scales
  with `viewerScoutLevel`.
- `bucketExperience(years): ExperienceTier`.
- `thesaurus` — pure module exposing `tierWordFor(attribute, value, precision)`.

### 2.5 API surface

- `GET /api/players/:id` → `RenderedPlayer`.
- `GET /api/players?clubId=&cursor=&limit=` → `{ items, nextCursor }`.
- `POST /api/players/generate` (dev-only) → `{ generated: number }`. Guarded
  by `AUTH_MODE === "dev"` or a dev flag.

### 2.6 UI (`@rpgfc/web`)

New components under `src/components/ui/`:

- `BadgeChip` — Style Guide §6.3. The most important component in the UI.
- `BadgeStack` — grouped badge display.
- `CertaintyText` — prose with per-span certainty styling.
- `TierPill` — qualitative tier chip, form gradient only.
- `NarrativeBlock` — the prose reading surface, `max-w-prose`, drop-cap on
  leads.
- `PlayerIdentityCard` — Style Guide §13.4.
- `KeyNumber` — ceremonial numeric display for the allowlisted cases (age,
  matches played, trophies won).
- `SectionHeader` — page-level heading with breadcrumb and actions.
- `TabBar` — horizontal tabs, 2px moss-500 border-bottom on the active tab.

New routes under `src/routes/`:

- `/players` — List archetype. Each row composes `PlayerIdentityCard`.
- `/players/$id` — Profile archetype. TabBar with Overview / History / Badges
  / Relationships / Contract / Reports. Story 01 ships Overview fully, other
  tabs as stubs with a "coming soon" panel.

Newsreader font is self-hosted under `packages/web/public/fonts/` (Story 00
§9.3 risk resolved).

### 2.7 Tests

- Unit: generation determinism (same seed → same output), thesaurus tier
  mapping, rendering output shape, prose generator produces no digits.
- Integration: seeded fixture save (seed=42) + round-trip through
  `/api/players/:id`.
- API: Hono test client coverage of all three new endpoints.
- Doctrine: Playwright walks `/players` and `/players/1`, asserts no leaks
  on either route.

---

## 3. In Scope

### 3.1 Shared types

`packages/shared/src/types/player.ts` is rewritten with the full hidden
vector and the full rendered shape. The brands from Story 00 stay put. Any
new hidden-only helper lands under `src/types/hidden.ts` and is imported
only by the server's rendering module.

```ts
export interface HiddenPlayer {
  readonly [HIDDEN_BRAND]: never;
  id: number;
  runId: number;
  clubId: number | null;
  name: string;
  dob: string;                          // ISO-8601
  nationality: string;
  preferredFoot: "Left" | "Right" | "Both";
  archetypeId: string;
  hiddenAttrs: {
    pace: number;
    finishing: number;
    composure: number;
    aerial: number;
    tackling: number;
    passing: number;
    vision: number;
    stamina: number;
    strength: number;
    reflexes: number;
  };
  mentalTraits: {
    composure: number;
    ambition: number;
    leadership: number;
    temperament: number;
    workEthic: number;
    sociability: number;
    riskTolerance: number;
    professionalism: number;
  };
  badgeIds: number[];
  experienceYears: number;
  narrativeSeed: { hometown: string; story: string };
}

export interface RenderedPlayer {
  readonly [RENDERED_BRAND]: never;
  id: number;
  name: string;
  age: number;                          // allowlisted
  nationality: string;
  preferredFoot: "Left" | "Right" | "Both";
  positionLabel: string;                // derived from archetype
  club: { id: number; name: string } | null;
  badges: BadgeRef[];
  prose: { identity: string; currentForm: string };
  certainty: CertaintyTier;
  experience: ExperienceTier;
}
```

### 3.2 Database schema (both dialects)

```
runs           id, seed, started_at, ended_at
clubs          id, run_id, name, nationality, founded_year, archetype_bias
archetypes     id (text), display_name, primary_role, gift_dist_json,
               trait_dist_json, starting_badge_ids_json, regional_flavor_json
badges         id, key (text unique), category, display_name,
               tiers_json, award_trigger, conditions_json, effects_json,
               prose_hooks_json, decay_rules, created_at
players        id, run_id, club_id, name, dob, nationality, preferred_foot,
               archetype_id, hidden_attrs_json, mental_traits_json,
               experience_years, narrative_seed_json, created_at
player_badges  player_id, badge_id, tier, awarded_at, awarded_reason
thesaurus      id, attribute (text), tier_index, word
```

Every `*_json` column is `TEXT` containing application-parsed JSON. No JSONB,
no ARRAY, no ENUM. The Story 00 portability scan stays green.

### 3.3 Seed data

Three JSON seed files committed under `packages/shared/src/constants/`:

- `archetypes.ts` — ~20 archetypes matching PRD §6.2:
  `pressing_forward`, `target_man`, `creative_ten`, `destroyer`,
  `sweeper_keeper`, `flying_fullback`, `ball_playing_cb`,
  `inverted_winger`, `box_to_box`, `deep_lying_playmaker`,
  `anchor_dm`, `wing_back`, `classic_nine`, `trequartista`,
  `mezzala`, `raumdeuter`, `stopper_cb`, `libero`, `shot_stopper`,
  `regista`. Each with per-attribute mean/spread and a short list of
  starting badges.
- `badges.ts` — ~30 seed badges. **Must include at least one from each
  of the six categories AND at least one instance of each effect type**:
  contextual_boost, behavior_modifier, event_trigger, role_unlock,
  team_effect, growth_modifier. Suggested slate:
  - Natural Gifts: `two_footed`, `lightning_quick`, `hawk_eyed`,
    `aerial_dominance`, `quick_reflexes`.
  - Mental Traits: `ice_in_veins`, `leader_of_men`, `hot_headed`,
    `tireless_runner`.
  - Positional Mastery: `inverted_winger`, `sweeper_keeper`,
    `target_man`, `deep_lying_playmaker`.
  - Earned Skill: `clutch_finisher`, `press_resistant`, `dead_ball_specialist`,
    `first_touch`, `aerial_threat`, `dribble_master`, `long_range_shooter`.
  - Achievement: `academy_graduate`, `golden_boot_nominee`,
    `cup_final_hero`, `iron_man`, `consistency`.
  - Relationship: `coachs_favourite`, `fan_favourite`, `derby_legend`.
- `thesaurus.ts` — 5–7 tier words per hidden attribute (e.g. pace:
  `plodding`, `steady`, `brisk`, `quick`, `rapid`, `electric`). Every word
  must be unique within its attribute. PRD §4.3 is the canonical source;
  where it leaves things open, pick the spare/specific word.

### 3.4 Generation pipeline

`packages/server/src/application/generation/` gets three files:

- `rng.ts` — mulberry32 PRNG with a seeded factory:
  `seededRng(seed: number): () => number`. Deterministic, reproducible, and
  cheap.
- `generate-player.ts` — implements PRD §6.1 exactly:
  1. Pick base archetype from a weighted pool (uses RNG).
  2. Sample natural gifts from archetype distribution (normal with mean +
     spread, clamped to [0, 100]).
  3. Sample mental traits similarly.
  4. Roll inborn natural-gift badges (5% chance of each archetype-compatible
     gift badge).
  5. Apply regional flavor (small nudge to gift distribution; Story 01 can
     ship a trivial version — two regions — and grow later).
  6. Assign narrative seed from a small hand-curated list of hometown +
     biography templates.
  7. Roll experience-appropriate starting badges (more for older players).
  8. Finalize DOB (archetype-scoped age range), preferred foot (weighted),
     nationality, contract placeholder.
- `generate-world.ts` — creates a run, seeds ~10 clubs, generates ~200
  players across those clubs. Exposed via `POST /api/players/generate` behind
  a dev guard.

The generator is **pure** given a seeded RNG. No `Math.random()` calls. No
`Date.now()` — all timestamps derive from a deterministic baseline date
injected via ctx.

### 3.5 Rendering layer

`packages/server/src/rendering/` gets:

- `player.ts` — `renderPlayer(hidden, ctx): RenderedPlayer`. Reads
  `hiddenAttrs`, computes age from DOB, resolves badges through
  `resolveBadges`, computes certainty, calls `generateIdentityProse` and
  `generateFormProse`, buckets experience, and returns a branded
  `RenderedPlayer`.
- `badges.ts` — `resolveBadges(hidden, ctx)` — fetches badge definitions,
  filters for visibility based on `viewerScoutLevel`, returns
  `BadgeRef[]` with per-badge certainty.
- `prose/identity.ts` — `generateIdentityProse`. Template-based with ≥4
  sentence shapes per archetype + variation rules. Reads thesaurus for
  tier words. **Never emits digits.** A unit test enforces this.
- `prose/form.ts` — `generateFormProse`. One sentence. Always.
- `certainty.ts` — `computeCertainty(hidden, ctx)`.
- `experience.ts` — `bucketExperience(years)`.
- `thesaurus.ts` — `tierWordFor(attribute, value, precision)`. `precision`
  is either `"fine"` (full 5–7 tiers) or `"coarse"` (3 tiers), determined
  by scout level.

The `no-hidden-in-routes` ESLint rule ensures routes never import any of
this directly — they go through the public barrel `rendering/index.ts`.

### 3.6 API

`packages/server/src/routes/players.ts`:

- `GET /api/players/:id` — validates the id, fetches the `HiddenPlayer` via
  the players service, passes to `renderPlayer`, returns.
- `GET /api/players` — Zod-validates optional `clubId`, `cursor`, `limit`.
  Returns a paginated list of `RenderedPlayer`.
- `POST /api/players/generate` — `{ seed?: number, count?: number }`. Only
  mounts when `env.AUTH_MODE === "dev"`. Generates + persists players.

The route chain stays inline in `createApiApp()` to preserve RPC type
inference.

### 3.7 UI components

Under `packages/web/src/components/ui/`, implemented to Style Guide §6:

- **`BadgeChip`** — 28px tall, 4px category stripe on the left, category
  glyph, label, 1–3 diamond tier markers, hover tooltip with the badge's
  prose description. Follows §6.3 exactly.
- **`BadgeStack`** — vertical or horizontal group of BadgeChips, grouped by
  category with a small-caps category label. Responsive wrap on small
  screens.
- **`CertaintyText`** — inline text with per-span certainty treatment
  (color + font-weight + italic), per §2.6. Takes a `{ text, certainty }`
  pair or an array.
- **`TierPill`** — qualitative tier as a single pill. Form gradient only.
  Never used for an abstract "rating."
- **`NarrativeBlock`** — Newsreader, `text-lg`, `leading-relaxed`,
  `max-w-prose`. Drop-cap on the first letter via `first-letter:` utility.
  Takes an array of paragraphs.
- **`PlayerIdentityCard`** — Style Guide §13.4 reference. Header row with
  position + age (age uses `-allowlist-number`), serif name, identity
  prose one-liner, badge chips, footer with a form strip placeholder
  (real form data ships in Story 03+).
- **`KeyNumber`** — ceremonial serif numeric display for allowlisted
  facts. `data-testid="{label}-allowlist-number"`.
- **`SectionHeader`** — `text-3xl` serif title, optional breadcrumb,
  optional right-side action slot.
- **`TabBar`** — horizontal, border-bottom indicator, 2px moss-500 on the
  active tab, 1px parchment-300 on inactive. Accepts an array of tab
  definitions and a selected key. TanStack Router-aware.

### 3.8 Routes (UI)

**`/players`** — List archetype (Style Guide §10.2):

- Top: filter bar stub (search placeholder, nothing functional in Story 01).
- Main: a column of `PlayerIdentityCard`s rendered from
  `api.api.players.$get()`.
- Right: Inspector pane — Story 01 ships an empty placeholder; live preview
  lands later.

**`/players/$id`** — Profile archetype (Style Guide §10.3):

- Top: 2px `--club-stripe` bar.
- Hero: club stripe + serif name + one-line identity summary + `BadgeStack`.
- `TabBar`: Overview (fully working) / History (stub) / Badges (stub) /
  Relationships (stub) / Contract (stub) / Reports (stub).
- Overview tab: `NarrativeBlock` with identity prose, `BadgeStack` grouped
  by category, and a facts grid (age, nationality, preferred foot,
  position, club). Facts in `font-mono` where allowlisted.

### 3.9 Doctrine extensions

`tests/doctrine/` gets two new specs:

- `players-list.spec.ts` — walks `/players`, asserts the presence of at
  least 3 `PlayerIdentityCard` instances, scrapes all `player-facing`
  elements, asserts no digit content.
- `player-profile.spec.ts` — walks `/players/1`, asserts the Overview tab
  is visible, scrapes, asserts clean. Clicks each tab stub, asserts no
  digit leaks appear during tab transitions.

The existing Story 00 specs still pass untouched.

---

## 4. Out of Scope

- **Real scouts, scout voices, scout assignment, knowledge graph.** Story 02 or 03.
- **Transfer market, contracts, bid mechanics.** Story 04+.
- **Match engine, even the stub.** Story 06.
- **Tactics editor, training plans, squad screens.** Story 05+.
- **Run lifecycle, season advance, Legacy Hall, modifiers.** Story 08.
- **Multi-club worlds with leagues and fixtures.** Story 07+.
- **LLM-based prose generation.** Story 01 is deterministic templates only.
- **Club theming from real club colors.** CSS variables exist; real
  themed pages come when clubs have colors in Story 03+.
- **Certainty by scout character.** `viewerScoutLevel` is a single integer;
  real per-scout certainty arrives with Story 02/03.
- **Save export / import.** Story 07.

---

## 5. Acceptance Criteria

Numbered `AC-NN` so they can be referenced from commits and PRs. Every AC
with an executable test follows red/green TDD ordering — write the test,
observe red, implement, observe green, paste the red output into the PR.

### 5.1 Shared types

**AC-01** — Expanded `HiddenPlayer` shape compiles
- **Given** `@rpgfc/shared` with the new `HiddenPlayer` definition.
- **When** `pnpm typecheck` runs across the workspace.
- **Then** exit code 0. Both `asHiddenPlayer` and the server's rendering
  module type-check against the full vector (pace through reflexes).
- **Verified by** `pnpm typecheck`.

**AC-02** — `RenderedPlayer` refuses to carry a raw numeric attribute
- **Given** a branch that adds `pace: number` to `RenderedPlayer`.
- **When** `pnpm typecheck` runs.
- **Then** exit code 0 (type system can't catch a name-based leak) BUT the
  Playwright doctrine suite fails when the UI renders it, AND a manual code
  review must reject the change.
- **Verified by** doctrine suite red on the fixture branch + review
  checklist item.

### 5.2 Database

**AC-03** — Migration applies cleanly on both dialects
- **Given** a fresh SQLite file and a fresh Postgres schema.
- **When** the migration runner executes `0001_player_identity.sql`.
- **Then** tables `players`, `clubs`, `badges`, `player_badges`,
  `archetypes`, `thesaurus`, `runs` all exist with the correct columns.
  The Story 00 `_meta` table is unaffected.
- **Verified by** `packages/server/src/test/player-migration.test.ts`
  — runs the migration twice (idempotency) and introspects the schema.

**AC-04** — Portability scan still green
- **Given** the new migrations.
- **When** `pnpm --filter @rpgfc/server test` runs the portability scan.
- **Then** no `JSONB`, `ARRAY`, or `CREATE TYPE` strings appear in any
  migration file (after stripping `--` line comments).
- **Verified by** the existing migrations-portability test from Story 00.

### 5.3 Generation

**AC-05** — Generation is deterministic from a seed
- **Given** a seed value `42`.
- **When** `generateWorld(42, { clubs: 10, playersPerClub: 20 })` runs twice
  in two fresh DB instances.
- **Then** both instances produce identical player names, archetypes, hidden
  attributes, mental traits, badge IDs, nationalities, and experience years
  — bit-for-bit identical.
- **Verified by** `packages/server/src/test/generation-determinism.test.ts`
  which compares a JSON serialization of the two worlds.

**AC-06** — Archetype distributions honored
- **Given** 1,000 `pressing_forward` players generated from different seeds.
- **When** their hidden `pace` values are averaged.
- **Then** the mean is within 10% of the archetype's declared `pace.mean`.
- **Verified by** `packages/server/src/test/generation-distribution.test.ts`.

**AC-07** — 60% badge coverage (PRD v1 acceptance)
- **Given** a fresh `generateWorld(42)`.
- **When** the resulting players are inspected.
- **Then** at least 60% of players have at least one `Achievement` or
  `EarnedSkill` badge. (PRD §19 Identity-System acceptance criterion,
  applied to the starting roster rather than to a five-season run — the
  five-season version lands in Story 06.)
- **Verified by** a unit test counting badges on a seeded world.

### 5.4 Rendering layer

**AC-08** — `renderPlayer` never emits digits in its prose
- **Given** any `HiddenPlayer` generated from seed 42.
- **When** `renderPlayer(hidden, ctx)` runs.
- **Then** neither `result.prose.identity` nor `result.prose.currentForm`
  contains a character matching `/\d/`.
- **Verified by** `packages/server/src/test/render-prose-no-digits.test.ts`
  iterating over the seeded roster.

**AC-09** — Certainty masking actually hides information
- **Given** a `HiddenPlayer` and two render contexts — `viewerScoutLevel: 0`
  (unknown) and `viewerScoutLevel: 5` (fully-known).
- **When** both are rendered.
- **Then** the low-scout result has `certainty: "Speculation"` or worse on
  at least 50% of its badge refs, and uses coarser tier words in its prose.
  The high-scout result has `certainty: "Certain"` on every confirmed badge
  and uses fine-grained tier words.
- **Verified by** `packages/server/src/test/render-certainty.test.ts`.

**AC-10** — Consistent thesaurus words
- **Given** the thesaurus seed.
- **When** `tierWordFor("pace", value, "fine")` is called across a
  representative set of `value`s.
- **Then** the same input always produces the same word, and the word set
  covers all 6 tiers.
- **Verified by** `packages/server/src/test/thesaurus.test.ts`.

### 5.5 API

**AC-11** — `GET /api/players/:id` returns `RenderedPlayer`
- **Given** a seeded world with player id 1.
- **When** the client calls `api.api.players[":id"].$get({ param: { id: "1" }})`.
- **Then** response is 200 and the body matches the `RenderedPlayer` Zod
  schema. Web-side TypeScript infers the same shape.
- **Verified by** `packages/server/src/test/players-route.test.ts` (Hono
  test client) and `packages/web/src/test/api-types.test-d.ts`
  (type-only assertion).

**AC-12** — `GET /api/players` paginates
- **Given** a seeded world with 200 players.
- **When** the client calls `?limit=10` repeatedly using the returned
  `nextCursor` until it is `null`.
- **Then** exactly 200 unique players are returned across the page series.
- **Verified by** `packages/server/src/test/players-route.test.ts`.

**AC-13** — Dev-only guard on `POST /api/players/generate`
- **Given** `AUTH_MODE=cognito` (prod-like).
- **When** the client calls `POST /api/players/generate`.
- **Then** response is 404 (not mounted) or 403 (mounted but guarded).
- **Verified by** `packages/server/src/test/players-route.test.ts`.

### 5.6 UI — component library

**AC-14** — `BadgeChip` renders per Style Guide §6.3
- **Given** `<BadgeChip label="Clutch Finisher" category="EarnedSkill" tier={2} />`.
- **When** rendered in jsdom.
- **Then** the element is 28px tall, has a 4px left stripe with the
  category-assigned color, renders the `Award` Lucide icon, shows `◆◆` as
  tier markers, and reveals a tooltip on hover.
- **Verified by** `packages/web/src/test/components/BadgeChip.test.tsx`.

**AC-15** — `CertaintyText` pairs color with font-weight and italic
- **Given** a text run with mixed certainty tiers.
- **When** rendered.
- **Then** `Certain` text is `font-semibold` upright parchment-900,
  `Speculation` text is `font-normal italic` parchment-500. Color alone is
  never the signal — the computed style carries weight and italicization.
- **Verified by** `packages/web/src/test/components/CertaintyText.test.tsx`.

**AC-16** — `NarrativeBlock` honors `max-w-prose` and drop-cap
- **Given** a multi-paragraph narrative.
- **When** rendered.
- **Then** the computed `max-width` is `640px` (the `max-w-prose`
  token), the first paragraph's `::first-letter` uses Newsreader serif, and
  the font family is Newsreader.
- **Verified by** `packages/web/src/test/components/NarrativeBlock.test.tsx`.

### 5.7 UI — pages

**AC-17** — `/players` renders a list with zero number leaks
- **Given** a dev server with a seeded world.
- **When** Playwright navigates to `/players`.
- **Then** at least 3 `PlayerIdentityCard` components are visible, and no
  element with `data-testid="player-facing"` contains a digit.
- **Verified by** `tests/doctrine/players-list.spec.ts`.

**AC-18** — `/players/1` Profile page renders cleanly
- **Given** the same server.
- **When** Playwright navigates to `/players/1`.
- **Then**:
  1. The club stripe is visible.
  2. A serif `h1` with the player's name is visible.
  3. A `NarrativeBlock` with the identity prose is visible.
  4. A `BadgeStack` with at least 1 chip is visible.
  5. The TabBar has 6 tabs; the "Overview" tab is active.
  6. No `data-testid="player-facing"` element contains a digit.
- **Verified by** `tests/doctrine/player-profile.spec.ts`.

**AC-19** — Profile page survives tab navigation
- **Given** `/players/1`.
- **When** Playwright clicks each stub tab in sequence.
- **Then** no tab renders a digit in a `player-facing` element; each stub
  tab shows a "Coming soon" placeholder.
- **Verified by** `tests/doctrine/player-profile.spec.ts`.

**AC-20** — Allowlisted numerics are explicit
- **Given** the Profile page.
- **When** Playwright finds the age element.
- **Then** it bears a `data-testid` ending in `-allowlist-number` and
  contains a digit. No other element with a digit is found.
- **Verified by** `tests/doctrine/player-profile.spec.ts`.

### 5.8 Fonts

**AC-21** — Newsreader is self-hosted and offline-capable
- **Given** a clean clone with no network.
- **When** `pnpm dev` runs and Playwright navigates to `/players/1`.
- **Then** the computed `font-family` of the `h1` reports `Newsreader`
  and the font file is loaded from `/fonts/Newsreader-*.woff2` (not
  `fonts.googleapis.com`).
- **Verified by** `tests/doctrine/player-profile.spec.ts`.

---

## 6. Suggested Task Breakdown

The story is large. Aim for small, reviewable PRs in this order. Each
depends on the previous.

1. **Shared types.** Expand `HiddenPlayer`, `RenderedPlayer`, add
   `BadgeDefinition`, `Archetype`, `ThesaurusEntry`, `ExperienceTier`.
   Update the public barrel. Update `types/hidden.ts`. Add brand tests.
2. **DB schemas + migrations.** Define the new Drizzle tables; write
   hand-rolled `0001_player_identity.sql` for both dialects; run the
   portability scan; add `player-migration.test.ts`.
3. **Seed constants.** Ship `archetypes.ts`, `badges.ts`, `thesaurus.ts`
   in `@rpgfc/shared/constants/`. Add unit tests asserting every
   category and every effect type is represented.
4. **Seed loader.** Application service that writes the seed data to the
   DB on first boot. Idempotent (`ON CONFLICT DO NOTHING` / dialect-safe
   equivalent).
5. **Generation pipeline.** RNG, `generatePlayer`, `generateWorld`.
   Write determinism test first (AC-05). Write distribution test first
   (AC-06).
6. **Rendering layer.** Start with `computeCertainty` and
   `bucketExperience` (pure, easy tests). Then `resolveBadges`. Then
   `thesaurus.tierWordFor`. Then `generateIdentityProse` with AC-08
   written first. Then `generateFormProse`. Finally `renderPlayer`
   composing them all.
7. **Players application service.** `getPlayerById`, `listPlayers`,
   `generateAndPersistWorld`. Returns `HiddenPlayer` shapes internally.
8. **Routes.** `/api/players/:id`, `/api/players`, `/api/players/generate`.
   Write AC-11/12/13 tests first.
9. **UI components — first pass.** Ship `BadgeChip`, `BadgeStack`,
   `CertaintyText`, `TierPill`, `NarrativeBlock`, `KeyNumber`,
   `SectionHeader`, `TabBar`, `PlayerIdentityCard`. Each with its own
   unit test (AC-14/15/16).
10. **Newsreader font self-hosted.** Drop Newsreader WOFF2 files under
    `packages/web/public/fonts/` and wire `@font-face` in `styles.css`.
11. **`/players` route.** Wire the List archetype, TanStack Query call to
    `/api/players`, render a column of `PlayerIdentityCard`s.
12. **`/players/$id` route.** Profile archetype, TabBar, Overview tab
    wired; other tabs stubbed with a shared `<ComingSoon>` placeholder.
13. **Doctrine extensions.** `players-list.spec.ts`,
    `player-profile.spec.ts`. Cover AC-17 through AC-21.
14. **Seeded dev experience.** On first `pnpm dev` boot, if the players
    table is empty, auto-call `generateWorld(42)` so a fresh clone can
    navigate to `/players` immediately. Document the behavior in
    `docs/README.md`.

---

## 7. Definition of Done

- Every AC (AC-01 through AC-21) passes its named verification.
- `pnpm dev` on a fresh clone produces a working `/players` list
  within 10 seconds of first boot.
- Navigating to `/players/1` shows a prose identity paragraph, a badge
  stack with ≥1 chip, and no numeric content except the allowlisted age.
- `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm doctrine` all
  exit 0 locally and in CI.
- The dual-database matrix passes on both SQLite and Postgres.
- The doctrine suite fails when a deliberate `<span
  data-testid="player-facing">Rating 84</span>` is injected into the
  Profile page. Documented and reverted.
- All new components are used exclusively via composition — no freestyle
  HTML in pages.
- `docs/README.md` is updated with the seeded-dev-experience note.
- `CLAUDE.md` subtree files are updated if new conventions land (for
  example if a new lint rule is added, or if the seed-data location
  moves).
- No player code references `Math.random()`. All randomness goes through
  the seeded RNG.
- No feature gated on real clubs, real scouts, or a real match engine
  has slipped in. This story stays focused.

---

## 8. Review Checklist

### 8.1 Structural

- The rendering layer is the only place `hiddenAttrs` is read. Grep
  proves it.
- The `no-hidden-in-routes` rule continues to fire on the fixture.
- `routes/players.ts` imports only from `../rendering/` and Zod schemas.
- The RPC client types still report the concrete `RenderedPlayer` shape,
  not `any`.

### 8.2 Content

- Seed badges cover every category and every effect type.
- Seed archetypes cover every starting-eleven position.
- Thesaurus tiers read like vocabulary, not like numbers. "plodding /
  steady / brisk / quick / rapid / electric" is fine. "slow / medium /
  fast" is lazy.
- Every prose template has at least 4 sentence shapes per archetype.
- No stereotype or caricature in the regional-flavor or narrative-seed
  data.

### 8.3 Style Guide adherence

- Zero `border-radius` except `rounded-full` for avatars.
- Zero `box-shadow` anywhere.
- Typography: Newsreader for prose, Inter for UI, JetBrains Mono for
  allowlisted numerics.
- `tabular-nums` on every numeric display.
- Max prose column = `max-w-prose` on all `NarrativeBlock` usage.
- Certainty tiers pair color with font-weight + italicization.
- Form gradient never used as a generic accent.
- Active tab = 2px moss-500 border-bottom. Inactive tabs = 1px
  parchment-300.
- Every icon is a Lucide stroke icon.

### 8.4 Doctrine

- AC-18 deliberate-violation walkthrough documented.
- `player-facing` tags applied on every rendering-originated element in
  the new components.
- Allowlisted numerics end in `-allowlist-number` and each use has a
  review justification in the PR.

### 8.5 Dual-DB

- Both dialects have a `0001_player_identity.sql` migration.
- The portability scan is green.
- CI matrix ran both dialects on the final PR.

---

## 9. Known Risks & Pitfalls

### 9.1 Prose repetition

**Risk:** Template-based generation gets stale after a dozen players and
the whole thesis collapses.

**Mitigation:** At least 4 sentence shapes per archetype, mandatory
alternation between shapes within a single profile, and an editorial
review checkpoint before the story ships. If you catch yourself reading
three profiles that feel identical, stop and add more variation before
moving on.

### 9.2 Badge balance

**Risk:** The 30 seed badges over- or under-represent one category and
the UI feels empty on most profiles.

**Mitigation:** Require every category and every effect type in the
slate. Add a unit test that fails if any category has zero badges.
Ship the slate as a pinned decision — expanding it is Story 01+.

### 9.3 Certainty UI

**Risk:** The five tiers' visual treatments are subtle. A new user can't
tell a `Confident` fact from a `Likely` one.

**Mitigation:** Ship `/players/1` with two viewerScoutLevel modes in
dev — a "fresh sign" mode and a "known for years" mode — and verify
visually that the two look meaningfully different. Document with
screenshots.

### 9.4 Generation distribution

**Risk:** Sampling from a normal distribution with narrow spreads clamps
most players to the archetype mean, making a whole generation feel
identical.

**Mitigation:** AC-06 enforces a 10% tolerance on the mean, not an
identity match. Each archetype declares its own `spread`, and the
generator pipelines through a post-sample noise injection to widen the
tail.

### 9.5 Scope creep into Story 02

**Risk:** The story acquires a navigation header "just to link between
the two new pages" and turns into a two-week accidental nav story.

**Mitigation:** Navigation is Story 02. Story 01 uses direct URLs and
`<a href>` tags for now. No `Header`, no `Nav`, no `Layout` beyond what
`__root.tsx` already has. If you catch yourself designing a sidebar,
stop.

### 9.6 Generation time on first boot

**Risk:** Seeding 200 players on first dev boot blocks the server
startup for seconds and `pnpm dev` feels broken.

**Mitigation:** Measure. If generation takes more than 2 seconds, make
it async and serve a "preparing your world" page. Target: full seed in
under 500ms on a local laptop.

### 9.7 Font licensing

**Risk:** Newsreader self-hosted without the correct license commitment.

**Mitigation:** Newsreader is OFL; ship `OFL.txt` alongside the WOFF2
files and note the license in `docs/README.md`.

---

## Appendix A — Example Archetype Record

```ts
export const PRESSING_FORWARD: Archetype = {
  id: "pressing_forward",
  displayName: "Pressing Forward",
  primaryRole: "Striker",
  giftDist: {
    pace:        { mean: 78, spread: 10 },
    finishing:   { mean: 74, spread: 12 },
    composure:   { mean: 70, spread: 10 },
    aerial:      { mean: 55, spread: 15 },
    tackling:    { mean: 35, spread: 12 },
    passing:     { mean: 60, spread: 12 },
    vision:      { mean: 62, spread: 12 },
    stamina:     { mean: 82, spread: 8 },
    strength:    { mean: 65, spread: 12 },
    reflexes:    { mean: 40, spread: 15 },
  },
  traitDist: {
    composure:        { mean: 68, spread: 12 },
    ambition:         { mean: 72, spread: 12 },
    leadership:       { mean: 55, spread: 18 },
    temperament:      { mean: 62, spread: 15 },
    workEthic:        { mean: 82, spread: 8 },
    sociability:      { mean: 60, spread: 15 },
    riskTolerance:    { mean: 65, spread: 12 },
    professionalism:  { mean: 70, spread: 12 },
  },
  startingBadgeIds: ["tireless_runner"],
  inbornBadgeChances: {
    lightning_quick: 0.15,
    two_footed: 0.05,
  },
  preferredPosition: "ST",
  ageRange: [18, 32],
};
```

## Appendix B — Example Badge Definition

```ts
export const CLUTCH_FINISHER: BadgeDefinition = {
  key: "clutch_finisher",
  category: "EarnedSkill",
  tiers: [
    { tier: 1, displayName: "Composed in the Moment",
      prose: "{name} has a reputation for staying calm when it counts." },
    { tier: 2, displayName: "Clutch Finisher",
      prose: "{name} steps up when matches are on the line." },
    { tier: 3, displayName: "Ice Cold",
      prose: "In a cup final at eighty-nine minutes, {name} looks the same as in a friendly in July." },
  ],
  awardTrigger: "season_end",
  conditions: { scoredInKnockoutAfter65: { gte: 3 } },
  effects: [
    { type: "contextual_boost",
      target: "composure",
      context: "knockout_after_65min",
      magnitude: 10 },
  ],
  proseHooks: [
    "{name} has ice in their veins.",
    "Give {name} the ball in the final ten minutes — you will not regret it.",
  ],
  decayRules: { kind: "none" },
};
```

## Appendix C — Thesaurus Example

```ts
export const PACE_TIERS = [
  "plodding",
  "steady",
  "brisk",
  "quick",
  "rapid",
  "electric",
] as const;
// Coarse 3-tier view for low-scout certainty:
export const PACE_TIERS_COARSE = [
  "slow",
  "average",
  "fast",
] as const;
```

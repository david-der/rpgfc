# RPG FC — Story 11

## Causal Match Core

Replace the scalar badge-count match stub with a deterministic football model
whose events are caused by players, roles, and tactics. Scores, statistics,
prose, and analysis all derive from the same persisted event log.

---

## Story Metadata

| Field | Value |
|---|---|
| Story ID | RPGFC-11 |
| Phase | Play Readiness — Football Causality |
| Depends on | RPGFC-09; public integration depends on RPGFC-10 |
| Blocks | RPGFC-12 and advanced analysis |
| References | PRD §2.2–2.3, §3.1, §10, §16; TDD v2 §9 |
| Status | Partially implemented; remaining gates are listed below |

## Current Implementation Status

A causal TypeScript engine is now the production simulation path for compiled
players. The protected compiler projects hidden football qualities, mental
traits, contextual badge keys, tactics, availability, bench state, and
familiarity into server-private simulation input. The engine emits ordered
events, substitutions, cards, injuries, player updates, and causal tags; the
season application persists those events and renders a multi-paragraph report
and timeline from persisted evidence. Focused SQLite tests cover determinism,
goal/event reconciliation, selected contextual effects, persistence, and
report evidence.

This story is not complete. Formation and role/position-fit effects are not yet
as deep as this contract requires, the event schema has phase but not the full
location-zone contract, non-goal facts are not all exactly reducible from
persisted events, and the engine uses one deterministic RNG rather than named
streams. The multi-season balance/performance gates and live Postgres parity
also remain unverified. A legacy badge-only compatibility path remains for old
fixtures that do not supply compiled player qualities; it is not the canonical
production path.

## 1. Supersession Notice

This story supersedes Story 06 and TDD v2 §9 only where they prescribe badge
count plus binary position fit as team strength and generate performance data
after the score. The `SimEngine` injection seam, deterministic seed contract,
and deferred Python service remain valid.

Canonical TDD §9 must describe the causal TypeScript implementation before
this story is declared complete; synchronization of that document was not
verified by this audit. Story 06's three-paragraph report target is replaced
by the PRD requirement of at least four paragraphs.

## 2. User Outcome

The manager can recruit a player for a known behavior, deploy that player in a
compatible role, choose a tactic that creates the intended situations, and
then find evidence of those decisions in the match timeline and report. Better
analysis pays because the match has discoverable causes rather than an opaque
team-strength roll.

## 3. In Scope

- A versioned `SimMatchInput` containing private football qualities, contextual
  badges, role/position assignment, formation, playing style, and instructions.
- A deterministic phase-based match model: possession, progression,
  contest/turnover, chance creation, shot, and restart/transition.
- Contextual use of natural gifts and mental traits during relevant actions.
- Badge effects triggered by named contexts; no raw badge-count strength.
- Role fit, position fit, tactical shape, and opponent interaction.
- A persisted, ordered event log with participants, zone/phase, outcome, and
  causal tags.
- Scores and team/player factual statistics reduced from that event log.
- A narrative report of at least four paragraphs using real event evidence.
- Balance and determinism harnesses over many seeds and full ten-team seasons.

### 3.1 Minimum tactical surface

The engine must distinguish at least the currently exposed formations and the
configured playing styles. It must consume the existing discrete instructions
for tempo, width, defensive line, pressing, build-up, and final-third focus.
Unsupported combinations fail validation rather than being silently ignored.

### 3.2 Event contract

Every persisted event has a stable sequence, match-clock fact, phase, event
kind, acting player where applicable, opposing player where applicable,
location band/zone, outcome, and zero or more causal tags. Example tags include
`press_broken`, `high_line_exposed`, `aerial_overload`, `midfield_outnumbered`,
`role_miscast`, and `transition_stopped`.

## 4. Out of Scope

- Story 12 owns acceptance of fatigue, injury, cards, suspension, bench use,
  and substitutions. The current causal engine already shares runtime support
  for these concerns, but they do not satisfy Story 11's open causality and
  balance gates by their presence alone.
- Tactical familiarity, chemistry, morale, and role-promise consequences.
- Live tactical changes, halftime talks, and interactive match playback.
- Detailed set-piece routines.
- Training, player development, badge awards, and opponent-analysis staff.
- A Python service implementation or LLM-authored match prose.
- Attempting to reproduce every physical action in football.

## 5. Architecture & Invariants

- `SimEngine` remains an injected application port. Routes and rendering do not
  import a concrete engine.
- Private sim input may contain numeric qualities but never becomes an API type.
- The engine uses named RNG streams derived from the match seed so adding prose
  variation cannot change the football result.
- Events are the source of truth. Goals, assists, shots, possession facts,
  player contribution evidence, and narrative moments are projections.
- A badge changes only a declared context. Equal badge counts do not imply
  equal ability or value.
- Tactical instructions modify choices and situations, not a hidden universal
  power score.
- Balance assertions operate over cohorts of seeds; no single match proves a
  quality or tactic effect.

## 6. Acceptance Criteria

**AC-01 — Byte-stable determinism**  
The same complete input, engine version, and seed produce deeply equal events,
score, facts, and narrative references on repeated runs.

**AC-02 — Relevant qualities cause relevant behavior**  
Across a pinned seed cohort, improving one private relevant quality changes the
expected action outcome in its intended direction while unrelated action
families remain within an agreed noise band.

**AC-03 — Mental traits are contextual**  
Composure, work ethic, risk tolerance, and temperament influence only declared
decision or pressure contexts; no mental-trait sum is used as team strength.

**AC-04 — Badges are identity, not quantity**  
A contextual badge measurably helps when its trigger is present and has no
material effect when absent. Replacing it with an unrelated badge while
keeping badge count constant changes the appropriate event distribution.

**AC-05 — Roles and tactics reach the engine**  
Changing role assignment, playing style, or a supported instruction changes
the expected event mix in a pinned cohort. A deliberate unsupported or dropped
instruction fails validation/test rather than behaving identically.

**AC-06 — Opponents interact**  
The effect of a tactic depends on the opposing shape and behavior; at least one
pinned matchup demonstrates an advantage and a different matchup demonstrates
its trade-off. No tactic is declared universally optimal.

**AC-07 — Events reconcile all facts**  
Persisted goals, scorers, assists, attempts, cards placeholder count, and team
totals can be recomputed exactly from events. The match row cannot contradict
its event log.

**AC-08 — Reporting cites real causes**  
Every played match produces a report of at least four paragraphs and a key
event timeline. Named players, score facts, and causal claims in the prose
correspond to persisted events/tags.

**AC-09 — Merit and variance balance gate**  
Over the ten-team multi-season harness, contextually stronger squads win more
often within documented bands, upsets still occur, home advantage remains in
band, and no supported style dominates every representative opponent profile.

**AC-10 — No public essence scalar**  
The engine emits no public numerical ability or performance rating. Public
outputs are events, factual counts, qualitative form evidence, and prose.

**AC-11 — Performance and dialect integration**  
A full 90-fixture season stays within the documented simulation budget and
persists/reloads equivalent event projections on SQLite and Postgres.

### Implementation evidence and remaining gaps

| AC | Audit status | Current evidence / remaining work |
|---|---|---|
| 01 | Partial | Focused tests verify deterministic score and event output for identical input. Byte-stable narrative references and named RNG streams are not verified. |
| 02 | Partial | Compiled natural gifts affect relevant actions in the causal engine; isolation/noise-band cohort coverage is incomplete. |
| 03 | Partial | Temperament and other mental inputs are consumed in declared contexts, with focused card behavior coverage. The full contextual/no-sum contract lacks cohort gates. |
| 04 | Partial | Contextual badge keys affect named situations; absent-trigger and unrelated-badge cohort comparisons are incomplete. |
| 05 | Partial | Playing style and discrete instructions reach the engine. Formation, role, and position-fit effects plus unsupported-combination validation remain open. |
| 06 | Partial | A pinned counter-attack versus high-line comparison exists. The opposite trade-off and no-universal-dominance gate do not. |
| 07 | Partial | Goal totals reconcile with goal events and events are persisted. Attempts, assists, cards, and every team/player fact are not all reconstructible exactly from the persisted event rows. |
| 08 | Verified in focused SQLite integration | Reports contain at least four paragraphs, causal language, and a persisted timeline whose goals match the score. Full API/Playwright evidence tracing is not verified. |
| 09 | Partial | Deterministic thousand-match cohorts verify that clearly better relevant qualities win from either orientation, identical sides receive a bounded home edge, and Possession's lift is symmetric after accounting for that edge. Multi-season variance and no-universal-tactic gates remain open. |
| 10 | Partial | Public no-rating tests exist. A private internal performance scalar remains, which is permitted only while it never crosses the rendering boundary. |
| 11 | Partial | The full ten-team season completes 90 causal fixtures in roughly a tenth of a second in SQLite with legal squads and real-player references. Live Postgres projection parity remains unverified. |

## 7. Red/Green Test Map

| AC | Red test written first | Green verification |
|---|---|---|
| 01 | `causal-sim-determinism.test.ts` freezes full input and output | deep-equality plus named-RNG-stream tests pass |
| 02–04 | `causal-effects.test.ts` runs counterfactual seed cohorts | documented distribution assertions pass without badge-count fallback |
| 05–06 | `tactical-counterfactuals.test.ts` compares roles/styles/instructions/opponents | event-mix and trade-off bands pass |
| 07 | `event-reducer.test.ts` starts with intentionally inconsistent aggregates | reducer-produced facts and persistence constraints pass |
| 08 | `match-report-evidence.test.ts` traces each report reference to an event | API and Playwright report/timeline tests pass |
| 09 | `ten-team-balance.test.ts` records cohort distributions | merit, variance, home, and tactic bands pass |
| 10 | Doctrine/schema fixture injects a numeric rating | API and DOM doctrine reject it |
| 11 | Full-season timed integration suite in both dialects | budget and parity gates pass |

Balance-band changes require an explicit rationale and distribution artifact in
the PR; they may not be loosened merely to make CI green.

## 8. Definition of Done

- AC-01 through AC-11 pass; the table above records the current partial state
  rather than claiming this gate is complete.
- TDD v2 §9 describes the causal v1 engine and still preserves the Python port.
- No scalar badge-count or universal team-strength shortcut remains in the
  shipped engine path.
- All exposed tactics are either consumed or rejected explicitly.
- Match rows, statistics, reports, and timelines reduce from one event log.
- The deterministic and balance harness artifacts are attached to the PR.
- Doctrine, typecheck, lint, unit, integration, full-season, and dialect matrix
  suites are green.

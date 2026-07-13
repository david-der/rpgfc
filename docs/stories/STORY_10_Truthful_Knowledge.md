# RPG FC — Story 10

## Truthful Knowledge Boundary & No-Ratings Doctrine

Make information cost real. A manager sees only observed facts, each claim
retains its source and certainty, scout work progresses with game time, and no
numeric player-performance rating reaches a public contract or screen.

---

## Story Metadata

| Field | Value |
|---|---|
| Story ID | RPGFC-10 |
| Phase | Play Readiness — Information Economy |
| Depends on | RPGFC-09 |
| Blocks | RPGFC-11 integration, future opponent analysis and transfers v3 |
| References | PRD §2.4, §7, §18.2–18.3, §19; TDD v2 §6, §18 |
| Status | Partially implemented; remaining gates are listed below |

## Current Implementation Status

External-player rendering now uses a viewer-specific knowledge projection:
unobserved gifts and badges are withheld, observed claims carry certainty and
source evidence, managed-club players receive the configured Certain baseline,
and Player Focus progresses through normal weekly advancement. Focused SQLite
tests also protect recent-match, squad, and Best XI responses from public
numeric performance ratings.

This story is not complete. The current public projection covers a strongest
natural-gift claim and observed badges, not the complete per-fact mental-trait
model. Public disagreement metadata and UI, the full assignment lifecycle and
Regional Watch flow, atomic/idempotent week integration, deliberate doctrine
leak fixtures, and live Postgres parity remain unverified. Public position and
identity labels also remain available independently of the observed gift and
badge projection; they must not be treated as evidence that hidden qualities
were revealed.

## 1. Supersession Notice

This story supersedes Story 03's allowance for player prose to continue
reading complete hidden state while knowledge changes only certainty. Public
hidden-derived qualities are now derived from a fact-level knowledge
projection; biographical and positional identity may remain public facts. An
unobserved hidden-derived fact is absent or explicitly Unknown, and the
renderer may not soften its true value into prose.

It also tightens Stories 01, 06, and 08: a numeric performance rating is not an
allowlist candidate. It is banned from public types, JSON, DOM, Best XI, form,
comparison, and transfer surfaces. Concrete facts such as age, score, goals,
appearances, and fees retain their existing justified allowlists.

## 2. User Outcome

An unfamiliar player begins as a genuine question. Assigning a scout and
advancing weeks reveals specific claims, possibly conflicting with another
scout. The manager can trace every claim to evidence without ever receiving a
cheat-code summary rating.

## 3. In Scope

- A fact-level `KnowledgeProjection` consumed by all public player rendering.
- Claims carrying fact key, qualitative value, certainty, source, and time.
- Explicit absence/Unknown behavior for every hidden-derived player fact.
- Per-badge and per-trait certainty rather than one global reveal switch.
- A documented Certain baseline for appropriate facts about the manager's own
  contracted players.
- Coexisting contradictory observations and a rendered disagreement state.
- Player Focus and Regional Watch assignment management in the normal UI.
- Automatic observation/report processing during weekly season advancement.
- Deterministic scout expertise, bias, and trust effects on observations.
- Removal of public numeric player-performance ratings and rating-derived UI.
- Doctrine tests at shared schema, API, and rendered-DOM levels.

## 4. Out of Scope

- Scout hiring, firing, promotion, or meta-progression.
- Opponent Analysis and analyst staff.
- Knowledge decay and stale-contract or stale-injury inference.
- AI-club knowledge models.
- LLM-written reports; deterministic voice templates remain authoritative.
- Player comparison redesign beyond removing summary ratings.
- Transfer negotiation uncertainty; that belongs to a later market story.

## 5. Architecture & Invariants

### 5.1 Projection boundary

`HiddenPlayer` remains the private source of truth. A rendering orchestrator
loads hidden state and the viewer's knowledge, but prose and badge renderers
receive only a `KnowledgeProjection`, never the hidden player. Public routes
receive only rendered types.

Separately, the protected server-private simulation compiler may read hidden
state to construct `SimPlayer` input. That compiler is not a public renderer;
neither hidden state nor its numeric simulation projection may reach routes,
shared public contracts, or web code.

A projection contains known claims and explicit unknown dimensions. Its
overall certainty may summarize coverage for orientation, but cannot reveal or
substitute for fact-level certainty.

### 5.2 Evidence model

Observations are append-only evidence. A new observation does not overwrite a
contradictory older claim. A deterministic resolver produces the currently
preferred claim while preserving disagreement metadata. Source quality,
expertise match, trust, recency, and repeated observations may affect the
resolution; raw hidden values never appear in that public explanation.

### 5.3 Time integration

The target contract is for weekly advancement to invoke scouting inside the
same application-level unit of work as other weekly effects and for replay of
an already completed week to be idempotent. The current implementation invokes
the observation tick from the normal advance path, but does so after the core
match transaction; atomic rollback and replay idempotence remain acceptance
gaps. The dev-only manual tick may remain for tests, but it is not the normal
gameplay path.

### 5.4 Rating purge

If an internal performance scalar remains useful, it uses an explicitly
private type and column name and never crosses the rendering boundary. Public
awards are selected from events and qualitative evidence, not exposed rating
order.

## 6. Acceptance Criteria

**AC-01 — Unknown means unknown**  
An external player with no observations may reveal public biographical and
positional identity, but reveals no hidden-derived strongest or weakest gift,
mental-trait conclusion, badge, or tactical fit in the API or DOM.

**AC-02 — Own-player baseline is explicit**  
Configured observable facts about a contracted own player render as Certain;
facts not covered by the baseline remain Unknown rather than inheriting a
global certainty value.

**AC-03 — Per-fact progression**  
Observing one fact changes only that fact's evidence and rendered certainty.
Unrelated traits and badges do not climb with the player's highest certainty.

**AC-04 — Disagreement is preserved**  
Two scouts can record incompatible claims about the same fact. Both claims
remain queryable and the profile/report UI identifies the disagreement,
sources, and observation recency without exposing which hidden value is true.

**AC-05 — Scout character matters**  
Across a fixed seed cohort, expertise match, bias, and trust produce pinned,
different observation behavior. Reports remain deterministic for the same
world, scout, target, and week.

**AC-06 — Assignments use the real week loop**  
Creating Player Focus or Regional Watch from the UI and advancing a week
produces observations and a report without calling the dev observation tick.

**AC-07 — Assignment lifecycle is complete**  
A scout has at most one active assignment; assignments can be started and
cancelled; completed Player Focus ends according to its configured completion
rule; invalid targets fail without partial writes.

**AC-08 — No public numeric performance rating**  
Public shared schemas, API snapshots, and every web route contain no universal
numeric player-performance rating or average-rating derivative. Best XI and
form surfaces use events, prose, and qualitative tiers.

**AC-09 — Deliberate leaks fail doctrine**  
Injecting either an unobserved true trait or a numeric performance rating into
a public response/DOM fixture causes the relevant doctrine test to fail.

**AC-10 — Dual-dialect and boundary integrity**  
The knowledge, observation, report, and assignment suites pass on SQLite and
Postgres; `no-hidden-in-routes` and hidden import restrictions remain green.

### Implementation evidence and remaining gaps

| AC | Audit status | Current evidence / remaining work |
|---|---|---|
| 01 | Partial | Route and rendering tests verify that an unobserved external player exposes no gift, badge, or professionalism claim. The broader fact-by-fact mental-trait/tactical-fit contract is not yet represented. |
| 02 | Partial | Managed-club rendering exposes the strongest gift and badges as Certain; per-fact Unknown behavior outside that baseline is not fully modeled. |
| 03 | Partial | Natural-gift, badge, and professionalism observations progress independently of hidden truth. A focused test changes the hidden professionalism value after observation and proves public prose is unchanged. The other mental traits remain open. |
| 04 | Open | Evidence rows remain queryable internally, but the preferred projection does not preserve public disagreement metadata or render a disagreement UI. |
| 05 | Partial | Deterministic scouting behavior exists, but pinned cohort coverage of expertise, bias, and trust is not complete for this story. |
| 06 | Partial | Player Focus is assignable from the player profile and creates observations and a report through normal SQLite week advancement. Regional Watch lacks equivalent coverage, processing is outside the core transaction, and the UI flow is not Playwright-verified. |
| 07 | Partial | Start and automatic Player Focus completion logic exists. Cancellation, invalid-target atomicity, and the complete UI lifecycle are not verified. |
| 08 | Verified in focused server tests | Recent-match, squad, and Best XI public JSON reject rating fields and use qualitative evidence. This does not by itself prove every web route. |
| 09 | Open | Story-specific deliberate hidden-fact and rating leak fixtures have not been demonstrated. |
| 10 | Unverified | SQLite coverage and import boundaries exist; live Postgres execution of the complete knowledge suite has not been demonstrated. |

## 7. Red/Green Test Map

| AC | Red test written first | Green verification |
|---|---|---|
| 01–03 | `knowledge-projection.test.ts` snapshots a zero-evidence stranger and one-fact observation | projection unit tests and player-route snapshots pass |
| 04–05 | `scout-disagreement.test.ts` records two fixed contradictory scouts | evidence resolver and report rendering tests pass |
| 06–07 | `scouting-week-loop.test.ts` advances through assignment states | API integration and Playwright assignment flow pass |
| 08–09 | Schema scan and doctrine fixtures deliberately expose `rating` and an unknown true badge | public schema/API/DOM doctrine suites reject both leaks |
| 10 | Run the full scouting suite in the dialect matrix and lint fixtures | both dialects and architecture gates pass |

The PR description records the observed red output for every new AC-numbered
test before implementation.

## 8. Definition of Done

- AC-01 through AC-10 pass.
- Only the rendering orchestrator and protected simulation compiler consume
  `HiddenPlayer`; prose/badge helpers and public routes receive projected or
  rendered types.
- No unknown fact is replaced with truthful hedged prose.
- Scout work progresses through normal week advancement.
- The reports UI offers a reachable assignment action and no false empty-state
  instruction.
- Public player ratings and rating-derived ordering are removed.
- API snapshots, doctrine, typecheck, lint, unit, integration, and both
  database matrices are green.
- The TDD rendering-boundary examples are updated if their signatures no
  longer match the implementation.

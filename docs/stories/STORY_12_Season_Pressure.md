# RPG FC — Story 12

## Season Pressure: Availability, Rotation & Familiarity

Turn an 18-match season into a sequence of squad decisions. Workload creates
fatigue, matches can create injuries and suspensions, the bench matters,
tactical changes take preparation, and actual selections determine whether
playing-time promises are being kept.

---

## Story Metadata

| Field | Value |
|---|---|
| Story ID | RPGFC-12 |
| Phase | Play Readiness — Season Consequences |
| Depends on | RPGFC-11 |
| Blocks | Training/development, chemistry, inbox, advanced transfers |
| References | PRD §3, §9, §10.6–10.7, §12, §19 |
| Status | Partially implemented; remaining gates are listed below |

## Current Implementation Status

The current TypeScript path persists private condition and discipline state,
renders the public availability tiers `Fresh`, `Ready`, `Heavy`, and `Spent`,
excludes injured and suspended players from normal selection, and supports
fatigue-aware substitutions, cards, injuries, suspension service, and tactical
familiarity movement. Focused SQLite tests cover squad availability rendering,
causal event persistence, suspension service, and familiarity reset/recovery.

This story is not complete. There is no managed match-squad validation API,
and substitutions do not yet use the full role/match-state contract. The
fallback picker now rejects an unfieldable squad with an actionable error
instead of fabricating players. Actual starts now drive persisted Star Player
promise streaks and qualitative relationship consequences. Complete
week-level atomicity/idempotence, full-season incidence/balance gates,
doctrine leak coverage, and live Postgres parity remain open.

## 1. Supersession Notice

This story supersedes Story 06's assumptions that every starter plays the full
match and that players cannot become unavailable through cards or injury. It
extends Story 05's promise-mood model: assigned squad role remains the promise,
but actual starts and appearances are the evidence used to judge whether it is
being honored.

The completed story implements the PRD requirements that benching a Star
Player for four consecutive matches triggers a relationship event and that a
mid-season tactic change carries a multi-match familiarity penalty. The
implementation-status table records which parts of that target remain open.

## 2. User Outcome

The manager cannot submit the same eleven indefinitely without consequences.
They read qualitative availability advice, rotate deliberately, use a valid
bench, absorb injuries and suspensions, and decide whether a tactical change is
worth short-term confusion.

## 3. In Scope

- Qualitative fatigue tiers and deterministic post-match/recovery transitions.
- Fatigue effects on relevant match actions and injury risk.
- Match-event injuries, injury status, qualitative prognosis, and recovery.
- Card events, competition-scoped accumulation, dismissals, and suspensions.
- Starting XI and bench validation before a managed match.
- Deterministic AI/fallback squad selection that respects availability.
- Substitution decisions by the simulation using bench, role, match state, and
  fatigue; persisted substitution events and appearances.
- Tactical familiarity per club/tactic, gained through use and reduced after
  material changes.
- Actual start/appearance streaks driving role-promise relationship events.
- Atomic weekly application of match and availability consequences.

### 3.1 Qualitative public state

Fatigue is exposed as `Fresh`, `Ready`, `Heavy`, or `Spent`. Injury and
recovery communication uses prose and qualitative time bands; suspension may
show the concrete number of league matches because it is a rule fact, not a
player rating. Internal numerical state remains private.

### 3.2 Selection contract

A legal league match squad contains eleven distinct available starters and a
configured bench of distinct available players, with no player in both sets.
Position mismatch is permitted as a costly football decision; injury and active
suspension are hard invalid states. If the club lacks eleven available players,
advance stops with an actionable exception rather than fabricating a player.

## 4. Out of Scope

- Weekly training focus, player development, mentoring, and badge awards.
- Chemistry, harmony effects in the simulator, captaincy, and team talks.
- User-controlled live substitutions or mid-match tactical changes.
- Set-piece routines.
- Registration, homegrown rules, multiple competitions, and cup-specific card
  rules.
- Detailed medical staff, rehabilitation choices, or injury recurrence models.
- Calendar congestion beyond the one-league weekly schedule.

## 5. Architecture & Invariants

- Availability state is persisted domain state, not derived from UI labels.
- Public qualitative tiers are rendered at the boundary; the simulator receives
  private workload and risk inputs.
- Injury, card, and substitution outcomes originate as causal match events.
- The weekly application service owns the transaction: match/event writes,
  appearances, fatigue, injuries, cards, suspensions, familiarity, promise
  streaks, and the week pointer commit together or roll back together.
- Recovery and suspension ticks are idempotent for a season/week key.
- Selection is a pure policy over roster, availability, roles, positions, and
  tactics, with a deterministic tiebreaker.
- Familiarity belongs to a tactic version. Material tactical edits create a new
  version or apply an explicit familiarity setback.

## 6. Acceptance Criteria

**AC-01 — Workload creates visible fatigue**  
Repeated starts move a player through qualitative fatigue tiers according to
the configured workload model; resting produces deterministic recovery.

**AC-02 — Fatigue has football consequences**  
Across a pinned seed cohort, Heavy and Spent players show the documented
decline in relevant late-match actions and increased injury risk compared with
the same Fresh player, without exposing the internal modifier.

**AC-03 — Injuries enforce availability**  
An injury event creates a persisted prognosis and makes the player ineligible
until recovery. Recovery occurs exactly once and restores eligibility.

**AC-04 — Cards enforce league suspensions**  
Card events update competition-scoped discipline state. A dismissal or the
configured accumulation threshold creates the correct suspension, and served
matches decrement it exactly once.

**AC-05 — Match squads are valid**  
The API rejects duplicate, injured, suspended, or starter-and-bench-overlap
selections atomically. It accepts a legal squad even when a player is used out
of position.

**AC-06 — Fallback selection is deterministic and legal**  
When the manager leaves slots unfilled, the picker selects an available legal
XI and bench using the documented role/position policy. If fewer than eleven
players are available, advancement returns an actionable exception and writes
no match result.

**AC-07 — Substitutions are causal and reconcile**  
The engine can make substitutions using bench availability, fatigue, role, and
match state. Every substitution is persisted in sequence; starter, substitute,
and appearance facts reconcile with the event log.

**AC-08 — Tactical familiarity has a multi-match cost**  
A material mid-season tactic change lowers familiarity and produces a pinned
short-term football penalty. Continued use raises familiarity over multiple
matches; switching back follows the documented retained-familiarity rule.

**AC-09 — Playing-time promises use actual matches**  
A Star Player who does not start four consecutive eligible league matches
triggers one relationship event. A start resets the consecutive-bench streak;
injury and suspension follow the documented exclusion rule and do not silently
count as managerial benching.

**AC-10 — Weekly consequences are atomic and idempotent**  
Any failure during availability or relationship processing rolls back the
matchday and week pointer. Reprocessing a committed season/week creates no
duplicate recovery, suspension, or relationship event.

**AC-11 — Full-season pressure gate**  
An automated 18-week ten-team season produces rotation, substitutions,
injuries, suspensions, and familiarity movement within documented balance
bands while every club remains able to field a side under the baseline seed.

**AC-12 — Dual-dialect and doctrine integrity**  
All state transitions and transactions behave equivalently on SQLite and
Postgres, and no fatigue, injury-risk, or familiarity number leaks through the
public player surfaces.

### Implementation evidence and remaining gaps

| AC | Audit status | Current evidence / remaining work |
|---|---|---|
| 01 | Partial | Public tier mapping and weekly fatigue/recovery updates exist. A pinned repeated-start/rest transition suite across all four tiers is not verified. |
| 02 | Partial | Private fatigue affects causal action chances and injury risk. The documented Heavy/Spent cohort effect bands remain open. |
| 03 | Partial | Injury events persist condition state and injured players are excluded. Exact-once prognosis/recovery lifecycle coverage is incomplete. |
| 04 | Partial | Cards, suspensions, exclusion, and served-match decrement exist. Threshold and exact-once competition-scope coverage is incomplete. |
| 05 | Open | No managed match-squad API was found to validate duplicates, overlap, or unavailable selections atomically. |
| 06 | Verified in focused SQLite integration | The picker is deterministic, excludes injured/suspended players, and returns an actionable failure when fewer than eleven eligible players remain. Synthetic player padding has been removed. |
| 07 | Partial | Fatigue-driven substitutions and appearance/event persistence exist. Full bench-role/match-state decision logic and exact reconciliation are not verified. |
| 08 | Partial | Tactical changes reset familiarity, match use raises it, and the simulator consumes it. Retained familiarity and multi-match cohort penalty/recovery gates remain open. |
| 09 | Verified in focused SQLite integration | Actual starts reset the persisted Star Player streak, unavailable weeks pause it, and the fourth eligible non-start emits one idempotent qualitative relationship event that is surfaced in squad/profile mood prose. The Postgres branch is implemented but not live-tested. |
| 10 | Partial | Core match events, performances, condition, discipline, and familiarity write in the match transaction. Other weekly effects run afterward; whole-week rollback, replay idempotence, and fault injection are not verified. |
| 11 | Characterized | A CI-safe non-AC audit completes all 18 weeks: minimum eligible squad 18, 13 injury events, 38 yellows, 1 red, 2 players ever suspended, 331 substitutions, and no unfieldable club. Multi-seed incidence bands and rotation-quality assertions remain open. |
| 12 | Unverified | Both database branches exist, but live Postgres parity and deliberate public-number leak coverage have not been demonstrated for this story. |

## 7. Red/Green Test Map

| AC | Red test written first | Green verification |
|---|---|---|
| 01–02 | `fatigue-model.test.ts` runs start/rest and counterfactual cohorts | transition and effect-band tests pass |
| 03–04 | `availability-events.test.ts` reduces fixed injury/card logs | persistence, eligibility, recovery, and suspension tests pass |
| 05–06 | `match-squad-validation.test.ts` submits invalid and incomplete squads | API transaction and deterministic picker tests pass |
| 07 | `substitution-reducer.test.ts` starts with non-reconciling appearance data | event/appearance reconciliation passes |
| 08 | `tactical-familiarity.test.ts` changes a tactic mid-season | multi-match penalty and recovery bands pass |
| 09 | `role-promise-streak.test.ts` covers starts, benching, injury, and suspension | exactly-one relationship-event assertions pass |
| 10 | Fault-injection test throws after match persistence but before weekly effects | rollback and replay-idempotence pass |
| 11 | `ten-team-season-pressure.test.ts` runs the baseline season | documented incidence and squad-viability bands pass |
| 12 | Run integration suites in both dialects plus a deliberate numeric leak | parity and doctrine gates pass |

Incidence and effect bands must be documented before implementation. Changing
them requires evidence, not merely a CI adjustment.

## 8. Definition of Done

- AC-01 through AC-12 pass; the table above records the current partial state
  rather than claiming this gate is complete.
- The same unchanged XI cannot play every week without modeled trade-offs.
- Injured and suspended players cannot reach the simulator as eligible.
- All appearances and substitutions trace to match events.
- Familiarity changes are visible in prose and consequential internally.
- Role-promise events are based on actual eligible-match participation.
- Weekly processing is atomic and idempotent on both dialects.
- Doctrine, typecheck, lint, unit, integration, full-season, and Playwright
  suites are green.
- Training, chemistry, live management, and registration have not leaked into
  the story.

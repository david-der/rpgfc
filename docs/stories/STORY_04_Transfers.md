# RPG FC — Story 04

## Transfer Market & Contracts (Walking Skeleton)

Land the bid → negotiation → contract pipeline end-to-end. Clubs become
buyers and sellers; players carry preferences that affect acceptance;
contracts grow from a placeholder into a multi-field record. No sim yet,
no transfer windows yet — Story 07 wires the calendar, Story 06 wires
the matches. Story 04 is what makes the market **exist**.

---

## Story Metadata

| Field | Value |
|---|---|
| Story ID | RPGFC-04 |
| Phase | Phase 2 — Information Economy |
| Estimate | 2 weeks solo, or ~8–12 focused Claude Code sessions |
| Depends on | RPGFC-00, RPGFC-01, RPGFC-02, RPGFC-03 |
| Blocks | RPGFC-05 (Tactics), RPGFC-08 (Meta), RPGFC-09 (AWS) |
| References | PRD §4.5, §8, §9.1; TDD v2 §6, §18; Style Guide §6, §10 |
| Status | Ready for implementation |

---

## 1. Summary

Story 03 taught the game how to **know** a player. Story 04 teaches it how
to **buy** one. The bid flow is a state machine: a club submits an offer,
the selling club and the target player each evaluate it, accept / reject
/ counter happens in discrete steps, and a contract materializes at the
end. Preferences the PRD surfaced (PRD §8.3) — playing time, wage floor,
geographic tie, former-club taboo — decide whether the player signs.

The Story 01 profile's **Contract** tab (currently a stub) wires up for
the first time. The primary nav grows a fourth entry: **Transfers**.

### 1.1 Why this story next

Story 03 produced an information economy. Story 04 introduces an actual
economy. Until you can move a player, the systems above the player are
decorative. Transfers are also the shortest path to exercising the
role-promise mood consequences that Story 05 will build on — if Story 04
stores a role promise on every contract, Story 05 can wire the
consequences without touching the contract shape.

### 1.2 User value

The first moment the manager is a **buyer**. Open `/transfers`, see a
list of listed players across seeded clubs, click any row to open a bid
dialog, fill in an offer (fee + wage + role promise + signing bonus),
submit, watch the selling club and the player evaluate it, and — if the
numbers and preferences align — see the player move to the user's club
with a stored contract. A short narrative banner announces the signing.

### 1.3 Not goals

- **No transfer windows.** Every player is always available. Story 07
  wires the seasonal calendar and the open/close dates.
- **No agents.** PRD §8.4's agent layer is a later story. Story 04
  negotiates directly with the player.
- **No AI club activity.** Rival clubs don't bid on players autonomously.
  The market's only buyer is the user. Story 04 ships a small "AI listing"
  module that picks which players each seeded club is willing to sell,
  but no one bids back.
- **No bid interception events.** PRD §8.8's dramatic third-club hijacks
  and leaked-fee events are deferred.
- **No sim-linked player valuations.** Valuations in Story 04 are
  deterministic functions of archetype + experience + observed badges.
  Story 06's sim can adjust them later.
- **No multi-club cascades.** No "sell-on clauses activate when player X
  is re-sold." Clause storage is in place; evaluation lands later.
- **No real currency ledger.** Story 04 treats budgets and fees as
  qualitative tiers backed by integer cents underneath — good enough
  for evaluation but not a full ledger. Real accounting lands with
  Story 08.

---

## 2. Technical Additions

### 2.1 Shared types

```ts
// @rpgfc/shared/src/types/contract.ts

export type PlayingTimeRole =
  | "Star Player"
  | "Important Player"
  | "Rotation"
  | "Backup"
  | "Youth/Development";

export interface Contract {
  id: number;
  playerId: number;
  clubId: number;
  /** Wage stored as cents for arithmetic; never shown as a number.
   *  The rendering layer buckets it into a qualitative tier word. */
  weeklyWageCents: number;
  signingBonusCents: number;
  /** Seasons left on the deal. Always 1..5 on new contracts. */
  seasonsRemaining: number;
  /** A non-financial commitment. Breaking it costs mood. */
  rolePromise: PlayingTimeRole;
  /** Optional release clause in cents; null = no clause. */
  releaseClauseCents: number | null;
  /** Loan contract flag — loans have their own shape overrides. */
  isLoan: boolean;
  loanDetails: LoanTerms | null;
  signedAt: string;  // ISO-8601
}

export interface LoanTerms {
  /** What fraction (0..1) of the loan wage the buying club pays. */
  wageCoveragePct: number;
  /** Minimum matches started or loan triggers a penalty. */
  playingTimeGuarantee: number;
  /** Optional obligation-to-buy trigger. */
  obligationToBuy: boolean;
  /** Loan end date — ISO-8601. Short of that is a recall window. */
  endsAt: string;
}

export interface BidRef {
  id: number;
  playerId: number;
  fromClubId: number;
  toClubId: number;
  /** Where in the negotiation state machine this bid currently sits. */
  state: BidState;
  /** Current proposal on the table. Each counter produces a new
   *  BidProposal row; BidRef.currentProposal points at the latest. */
  currentProposal: BidProposal;
  /** Qualitative summary for the UI — "Well below asking",
   *  "At asking", "Above asking". Driven by the selling club's
   *  stance, not the raw cents. */
  stance: BidStance;
  createdAt: string;
  updatedAt: string;
}

export type BidState =
  | "Draft"
  | "Submitted"
  | "SellerReviewing"
  | "SellerRejected"
  | "SellerCountered"
  | "SellerAccepted"
  | "PlayerReviewing"
  | "PlayerRejected"
  | "PlayerAccepted"
  | "Signed"
  | "Expired";

export type BidStance = "BelowAsking" | "AtAsking" | "AboveAsking";

export interface BidProposal {
  id: number;
  bidId: number;
  authorKind: "buyer" | "seller";
  feeCents: number;
  wageCents: number;
  signingBonusCents: number;
  rolePromise: PlayingTimeRole;
  loanOffer: LoanTerms | null;
  createdAt: string;
}
```

### 2.2 Database

New tables, both dialects:

```
contracts         id, player_id (unique), club_id, weekly_wage_cents,
                  signing_bonus_cents, seasons_remaining, role_promise,
                  release_clause_cents, is_loan, loan_details_json,
                  signed_at

bids              id, player_id, from_club_id, to_club_id, state,
                  current_proposal_id, stance, created_at, updated_at

bid_proposals     id, bid_id, author_kind, fee_cents, wage_cents,
                  signing_bonus_cents, role_promise, loan_details_json,
                  created_at

listing           id, player_id (unique), asking_price_cents,
                  reason ("rebuild" | "wage_trim" | "squad_overhaul"),
                  listed_at

player_preferences id, player_id (unique), wage_floor_cents,
                   min_playing_time, preferred_regions_json,
                   forbidden_club_ids_json
```

Story 03's club identity_ext gains a `cash_reserve_cents` column so
buying clubs can actually afford things.

All cents are stored as INTEGER. No JSONB for `loan_details` or
`preferred_regions` — they're TEXT. Portability scan stays green.

### 2.3 Application layer

```
packages/server/src/application/transfers/
  valuations.ts       — estimateValueCents(player, listing?)
                        deterministic function of archetype/experience/badges
  evaluate-bid.ts     — seller decision + player decision + role-promise
                        checks + counter-offer synthesis
  submit-bid.ts       — validate inputs, insert bid + proposal, move
                        state to SellerReviewing
  counter.ts          — new proposal attached to an existing bid, state
                        transitions
  sign.ts             — on PlayerAccepted, create a Contract row, move
                        bid to Signed, update player's clubId
  listings.ts         — seed which players are willing to leave each
                        club on world generation

packages/server/src/application/contracts/
  query.ts            — getContractByPlayer, listContractsByClub
```

### 2.4 Rendering layer

```
rendering/
  contract.ts     — renderContract(Contract): RenderedContract with
                    qualitative wage tier, qualitative fee tier, no cents
                    on the wire
  bid.ts          — renderBid(BidRef): all cents stripped, stance + state
                    preserved, qualitative summary surfaced
```

`RenderedContract` is the only thing the web ever sees. Cents stay
server-side. The tier mapping is backed by a simple five-stop scale
(`Minimal` / `Modest` / `Notable` / `Significant` / `Elite`) per wage
or fee amount, derived from percentile-of-squad — PRD §8 style.

### 2.5 Routes

```
GET  /api/transfers              listed players + your pending bids
GET  /api/transfers/:playerId    rendered bid history + current
                                   listing + player preferences (qualitative)
POST /api/transfers/:playerId/bid    submit a new bid or counter
POST /api/transfers/:playerId/withdraw  cancel the current bid
GET  /api/players/:id/contract   current contract (rendered)
```

All routes stay inside the Story 02 rendering boundary: no `Contract`
shape with raw cents reaches the wire. `RenderedContract` is the only
payload.

### 2.6 UI

New routes:

- **`/transfers`** — List archetype. A two-column split (left: listed
  players, right: your pending bids with state badges). Cards use a
  new `ListingCard` component.
- **`/transfers/$playerId`** — Editor archetype. Shows the player's
  identity header (reused from Story 01), a `BidHistory` timeline of
  proposals, and a `BidComposer` form for the next proposal.

Updated routes:

- **`/players/$id`** Contract tab wires up for the first time. Renders
  a `ContractCard` with qualitative wage/role-promise rows, seasons
  remaining, and a release-clause line if present.
- **Primary nav** grows to **Home / Players / Scouts / Transfers**.

New components:

- `ListingCard` — List-archetype row for a listed player. Shows the
  player identity (reuses `PlayerIdentityCard` internals), the
  club's asking stance, and the user's current bid state if any.
- `BidComposer` — Editor archetype form. Role Promise select,
  qualitative fee and wage tier selectors (never raw cents), loan
  toggle, Submit.
- `BidHistory` — Timeline of proposals most recent first, each
  showing `authorKind` + qualitative summary + stance arrow.
- `ContractCard` — reading card for the profile Contract tab. Wage
  tier, role promise, seasons remaining, release clause.
- `PlayingTimeSelect` — shared select for PlayingTimeRole used by
  both Squad (Story 05) and Contracts (Story 04).

### 2.7 Seed content

- `seed-listings.ts` — on world gen, each seeded club lists 1–3
  players for sale. Deterministic selection seeded by `clubId`.
- `seed-preferences.ts` — every generated player gets a preference
  row: wage floor tier, min playing time, a small set of preferred
  regions, and a small set of forbidden-club ids.

---

## 3. In Scope

### 3.1 Clubs become buyers and sellers

Story 03 added `club_identity_ext` with a `wage_budget_tier`. Story 04
refines this into a real cents-based `cash_reserve_cents` and a
`wage_budget_cents_per_week` column. The UI never sees the cents —
everything is buckets — but the evaluation code needs arithmetic.

The seeded numbers are deterministic from club reputation: Elite ~ 80x
Local. This is intentionally simple; Story 08 and the match engine can
evolve it later.

### 3.2 Listings

Each seeded club publishes 1–3 listed players on world gen. Listing
logic picks players whose archetype overlaps the club's "available for
sale" pool (kept intentionally shallow: the three oldest non-Elite
players per club). Each listing carries a qualitative asking price
bucket and a reason string ("rebuild", "wage_trim", "squad_overhaul").

### 3.3 Bid flow state machine

```
Draft → Submitted → SellerReviewing
                      ├─ SellerRejected      (terminal)
                      ├─ SellerCountered     ← buyer can re-propose
                      └─ SellerAccepted → PlayerReviewing
                                           ├─ PlayerRejected (terminal)
                                           └─ PlayerAccepted → Signed
                                                                 (terminal)
```

- Every transition writes a row to `bid_proposals` if it carries new
  terms.
- `Expired` is a safety-net terminal for stalled bids older than a
  configured TTL. Story 04 hardcodes the TTL; Story 07 ties it to the
  calendar.
- Only `Submitted`/`SellerCountered`/`PlayerReviewing` have next-state
  actions available from the UI — all others are read-only.

### 3.4 Seller decision

Given a proposal from the buyer, the selling club:

1. Compares the fee to its asking price.
2. Applies a qualitative tolerance: within 10% → accept, within 25% →
   counter-offer at the midpoint, else reject.
3. Also rejects if the buying club cannot afford the wage bill (sum
   of current wages + new wage > `wage_budget_cents_per_week`).

### 3.5 Player decision

Given a proposal that the seller has accepted, the player:

1. Checks wage ≥ wage floor.
2. Checks `rolePromise` ≥ `min_playing_time`.
3. Checks `toClubId ∉ forbidden_club_ids`.
4. Checks `toClubNationality ∈ preferred_regions` (or globally
   preferred).
5. Accepts if all four pass. Otherwise rejects with a reason that
   surfaces qualitatively on the `/transfers/$playerId` page:
   _"He wants more game time than this club can realistically
   offer."_

All four checks are pure functions of the player's preferences row
and the proposal + buyer club shape. Unit-testable.

### 3.6 Contract creation on sign

Transitioning to `Signed` creates a `contracts` row:

- `weeklyWageCents` = accepted proposal's wage
- `signingBonusCents` = accepted proposal's signing bonus
- `seasonsRemaining` = 3 by default for Story 04 (Story 05 lets the
  manager pick 1–5)
- `rolePromise` from the proposal
- `releaseClauseCents` = null unless explicitly set in the proposal
- `isLoan` / `loanDetails` per the proposal
- `signedAt` = now

The player's `clubId` is updated to the buying club. Old contract
rows are archived (a `contracts_archive` table is **not** added —
Story 04 just updates the `player.clubId`; contract history lands
with Story 08).

### 3.7 Role promise storage — coupling deferred

Story 04 **stores** the role promise on the contract but does not
wire the mood consequences. Story 05 (Squad Management) consumes the
`rolePromise` field when computing mood if the player's actual match
rotation drifts below it. The key invariant: the contract shape must
carry the promise so Story 05 doesn't have to re-migrate.

### 3.8 Doctrine — no cents on the wire

The doctrine suite gains one more invariant for Story 04: every
element under `data-testid="player-facing"` on `/transfers`,
`/transfers/$id`, and `/players/$id/Contract` tab must contain **no
digit**. Fees and wages render as qualitative tier words from a new
currency thesaurus (`"Modest" / "Notable" / "Significant" / "Elite"`,
etc.) and a diamond-tier arrow indicator for relative comparisons.

One allowlisted numeric surface exists: `seasons remaining`, which is a
plain integer the PRD's own UI model accepts as a concrete fact.
Tagged `data-testid="seasons-remaining-allowlist-number"`.

### 3.9 Nav registry update

`PRIMARY_NAV` gains the Transfers entry:

```ts
{ key: "transfers", label: "Transfers", to: "/transfers", icon: Handshake }
```

`isNavItemActive` continues to match `/transfers` and `/transfers/42`
alike without any rule change.

---

## 4. Out of Scope

- **Transfer windows** — Story 07.
- **Rival club bidding** — a later story.
- **Agents** — a later story.
- **Sell-on clauses, minimum fee clauses, wage rise clauses, image
  rights** — the Contract shape stores a spot for each but Story 04
  evaluates only wage + fee + signing bonus + release clause + role
  promise.
- **Real currency unit or ledger** — Story 08.
- **Narrative press events around signings** — one short celebratory
  banner on `Signed` transition, nothing more.
- **Contract renewals and extensions** — Story 05+.

---

## 5. Acceptance Criteria

### 5.1 Shared + DB

**AC-01** — New types compile; WirePlayer gains an optional
`contract: RenderedContract | null` field.
- **Given** the Story 04 types land.
- **When** `pnpm typecheck` runs.
- **Then** exit 0.
- **Verified by** `pnpm typecheck`.

**AC-02** — Migration `0003_transfers.sql` applies on both dialects
and the portability scan stays green.
- **Verified by** `packages/server/src/test/transfers-migration.test.ts`.

### 5.2 Seed + valuations

**AC-03** — Every seeded club lists 1–3 players.
- **Given** `generateWorld(seed=42)` with the Story 04 seeder added.
- **When** the `listing` table is queried.
- **Then** every club has between 1 and 3 listed players, inclusive.
- **Verified by** `packages/server/src/test/listings-seed.test.ts`.

**AC-04** — Every generated player gets a preferences row.
- **Given** the seed run.
- **When** the `player_preferences` table is queried.
- **Then** row count equals player count.
- **Verified by** `packages/server/src/test/preferences-seed.test.ts`.

**AC-05** — Valuation is deterministic.
- **Given** the same player and listing.
- **When** `estimateValueCents()` runs twice.
- **Then** the result is identical.
- **Verified by** `packages/server/src/test/valuations.test.ts`.

### 5.3 Bid flow

**AC-06** — Happy path end-to-end.
- **Given** a listed player and a buying club with enough cash and
  wage room.
- **When** the user submits a bid at the asking fee, the seller accepts,
  the player accepts, and the Sign transition fires.
- **Then** a contract row is created, `player.clubId` is updated, the
  bid state is `Signed`, and `listing` row for the player is deleted.
- **Verified by** `packages/server/src/test/bid-flow-happy.test.ts`.

**AC-07** — Seller rejection path.
- **Given** a bid whose fee is ≥30% below the asking price.
- **When** the seller evaluates it.
- **Then** state is `SellerRejected`, no counter-proposal is
  generated, and the UI surfaces a qualitative rejection message.
- **Verified by** `packages/server/src/test/bid-flow-seller-reject.test.ts`.

**AC-08** — Seller counter path.
- **Given** a bid whose fee is 10–25% below asking.
- **When** the seller evaluates.
- **Then** state is `SellerCountered`, a new `bid_proposals` row
  appears with `authorKind="seller"`, and the fee is the midpoint
  between buyer and asking.
- **Verified by** `packages/server/src/test/bid-flow-counter.test.ts`.

**AC-09** — Player rejects on wage floor.
- **Given** an accepted seller proposal below the player's wage
  floor.
- **When** the player evaluates.
- **Then** state is `PlayerRejected`, the reason returned surfaces
  qualitatively as "wage too low for his expectations", and no
  contract is created.
- **Verified by** `packages/server/src/test/player-reject-wage.test.ts`.

**AC-10** — Player rejects on forbidden club.
- **Given** a proposal where `toClubId` is in the player's
  `forbidden_club_ids`.
- **When** the player evaluates.
- **Then** state is `PlayerRejected` with a qualitative reason.
- **Verified by** `packages/server/src/test/player-reject-forbidden.test.ts`.

**AC-11** — Loan path is fully separable.
- **Given** a bid with `loanOffer` set.
- **When** the bid proceeds to Signed.
- **Then** the created contract has `isLoan=true` with a populated
  `loanDetails`, and the player's `clubId` is still the originating
  club (loans don't transfer ownership).
- **Verified by** `packages/server/src/test/bid-flow-loan.test.ts`.

### 5.4 API

**AC-12** — `GET /api/transfers` returns listed players + pending
bids.
- **Given** the seeded run.
- **When** the client fetches `/api/transfers`.
- **Then** response has `{ listings: ListingRef[], pending:
  BidRef[] }`, none of which contain raw cents anywhere.
- **Verified by** `packages/server/src/test/transfers-route.test.ts`.

**AC-13** — `POST /api/transfers/:playerId/bid` persists a bid.
- **Given** a valid proposal body.
- **When** the endpoint is called.
- **Then** a bid + proposal row exists in the DB and the response
  carries the new `BidRef`.
- **Verified by** `packages/server/src/test/transfers-route.test.ts`.

**AC-14** — `GET /api/players/:id/contract` returns `RenderedContract`
with no cents.
- **Given** a signed player.
- **When** the endpoint is called.
- **Then** response is 200 and every numeric cent field is absent;
  qualitative tier words are present instead.
- **Verified by** `packages/server/src/test/contract-route.test.ts`.

### 5.5 UI

**AC-15** — `/transfers` renders listing cards with zero digit leaks.
- **Given** the seeded world.
- **When** Playwright navigates `/transfers`.
- **Then** ≥5 `ListingCard` rows are visible and no
  `data-testid="player-facing"` element contains a digit. The
  `seasons-remaining-allowlist-number` is the only numeric surface
  in the transfers shell.
- **Verified by** `tests/doctrine/transfers.spec.ts`.

**AC-16** — `/transfers/$playerId` shows the bid composer.
- **Given** `/transfers/1` with the player listed and no existing bid.
- **When** the user opens the page.
- **Then** a `BidComposer` form is visible with Role Promise,
  qualitative Fee, qualitative Wage, and Loan toggle fields. Submit
  is disabled until at least the fee and wage are chosen.
- **Verified by** `tests/doctrine/transfers.spec.ts`.

**AC-17** — Happy-path bid surfaces a contract on the profile.
- **Given** a successful bid (Playwright walk: compose → submit →
  accept paths exercised through the dev endpoint).
- **When** the user navigates `/players/1` → Contract tab.
- **Then** a `ContractCard` renders with wage tier, role promise,
  and seasons remaining (the single allowlisted numeric surface).
- **Verified by** `tests/doctrine/transfers.spec.ts`.

**AC-18** — Nav registry reflects Transfers and active state resolves.
- **Given** `/` → click Transfers → `/transfers/1`.
- **When** Playwright inspects the active nav item at each step.
- **Then** Home is active on `/`, Transfers is active on `/transfers`,
  Transfers remains active on `/transfers/1`.
- **Verified by** `tests/doctrine/transfers-nav.spec.ts`.

### 5.6 Doctrine

**AC-19** — Full suite still exits 0, now 30+ specs.
- **Verified by** `pnpm doctrine` in CI + locally.

---

## 6. Suggested Task Breakdown

1. **Shared types.** `Contract`, `LoanTerms`, `BidRef`, `BidState`,
   `BidProposal`, `BidStance`, `RenderedContract`, `RenderedBid`,
   `PlayingTimeRole`. Export from the public barrel.
2. **Migration.** `0003_transfers.sql` for both dialects, including the
   `cash_reserve_cents` + `wage_budget_cents_per_week` columns on
   the club identity table.
3. **Seed.** Listings + preferences on world gen. Tests: AC-03, AC-04.
4. **Valuations.** Pure function over archetype + experience + top
   badges. Test: AC-05.
5. **Seller evaluation.** Accept / counter / reject based on asking
   price tolerance and buyer wage room. Tests: AC-07, AC-08.
6. **Player evaluation.** Wage floor + playing time + forbidden club +
   region preference checks. Tests: AC-09, AC-10.
7. **Bid state machine + sign.** `submit`, `counter`, `sign`, `withdraw`
   handlers. Tests: AC-06, AC-11.
8. **Rendering.** `renderContract`, `renderBid`. Qualitative tier
   buckets, no cents on the wire. Tests: AC-14.
9. **Routes.** `GET /api/transfers`, `GET /api/transfers/:playerId`,
   `POST /api/transfers/:playerId/bid`,
   `POST /api/transfers/:playerId/withdraw`,
   `GET /api/players/:id/contract`. Tests: AC-12, AC-13.
10. **UI components.** `ListingCard`, `ContractCard`, `BidComposer`,
    `BidHistory`, `PlayingTimeSelect`.
11. **UI routes.** `/transfers`, `/transfers/$playerId`, Contract tab
    wiring on `/players/$id`.
12. **Nav entry.** Append `transfers` to `PRIMARY_NAV`.
13. **Doctrine specs.** `transfers.spec.ts`, `transfers-nav.spec.ts`.
14. **Dev helper.** A dev-only button on `/transfers/$playerId` that
    **forces** the seller and player to accept the current proposal,
    so the signing path can be exercised by a click without
    constructing a preferences-compatible bid manually.

---

## 7. Definition of Done

- Every AC-01 through AC-19 passes.
- On a fresh `pnpm dev`, the flow: `/transfers` → click a listing →
  fill the composer at asking tier + satisfactory role promise →
  Submit → Force Accept → `/players/$id` Contract tab shows the new
  `ContractCard`. All without a full page reload.
- No cents ever appear on the wire. The doctrine suite enforces this
  via the `data-testid="player-facing"` scrape.
- Nav now has four items; all four active-state transitions work on
  deep-link.
- The Story 03 scouting surface is unaffected; scout reports still
  render, observation tick still advances certainty.
- `packages/web/CLAUDE.md` gains §11 "Transfers UI", and
  `packages/server/CLAUDE.md` gains §9 "Transfer market" explaining
  the cents-never-on-the-wire invariant.
- A deliberate `<span data-testid="player-facing">£14m</span>`
  injection into any new route is caught by **both** the ESLint rule
  and the doctrine suite.

---

## 8. Review Checklist

### 8.1 Structural

- `Contract` type carries cents fields; `RenderedContract` does not.
- The route layer only sees `RenderedContract` / `RenderedBid` — no
  raw cents.
- `renderContract` is the single place cents become tier words.
- `no-hidden-in-routes` rule stays armed.

### 8.2 Content

- Currency thesaurus has ≥5 tier words per fee / wage direction, each
  specific enough to be memorable: "a small move", "a notable
  purchase", "a marquee signing".
- Role promise enum is stable with the PRD §9.1 roles.
- Preferences seeding picks at least 1 forbidden club and 1
  preferred region per player for variety.

### 8.3 Doctrine

- `seasons-remaining-allowlist-number` is the only numeric surface
  on `/players/$id` Contract tab and on every `/transfers/*` route.
- `ContractCard` wraps itself in `data-testid="player-facing"` on
  the qualitative rows.
- Deliberate-violation walkthrough documented in the PR description.

### 8.4 Style Guide

- `ListingCard` composes `PlayerIdentityCard` internals; it does not
  reinvent the identity row.
- `BidComposer` follows the Editor archetype: left work area (player
  preview), right Configuration panel, bottom persistent action bar
  (Submit / Withdraw). Never a floating action button.
- `ContractCard` carries no `shadow-*`, no `rounded-*`, and uses the
  Style Guide §5.5 Card skeleton.

---

## 9. Risks & Pitfalls

### 9.1 Cents on the wire

**Risk:** A tired developer adds `weeklyWageCents` to a route response
for "debugging" and ships it.

**Mitigation:** The render layer is the only path from DB rows to
responses; routes never import the raw contract module; a new
doctrine rule extends the existing DOM scrape to assert no
`£|\$|€` character appears under `player-facing` either. (Cheap
regex, big payoff.)

### 9.2 State machine sprawl

**Risk:** The 10-state bid machine tempts future stories to add
states inline ("OnHoldBecauseInjury", "PendingMedical", ...).

**Mitigation:** Document the state set at the top of
`bid-state.ts` and flag adding a new state as a red-flag change.
If a feature needs a new state, it should open a fix spec the way
FIX-01 did for Story 01.

### 9.3 Preferences read as mechanical

**Risk:** "Rejected: wage too low" reads like a database error, not
a character moment.

**Mitigation:** The rejection reason goes through a small prose
template pool. A "wage floor" rejection reads as _"He expected
something closer to a proper reward for a player at his level —
this will not be that move."_ The template lives next to the rest
of the scout voice templates so future stories reuse the same
infrastructure.

### 9.4 Loan vs permanent entangles the schema

**Risk:** Adding loans after permanent bids are working risks a
second state machine.

**Mitigation:** Loans are a **flag** on the same bid flow. The
only difference is the signing step creates a `Contract` with
`isLoan=true`, and the sign handler keeps the player's
`clubId` on the originating club. No second state machine.

### 9.5 Valuation drift without the sim

**Risk:** Valuations derived from archetype + experience + badges
hard-code assumptions that the match engine could later disagree
with.

**Mitigation:** `valuations.ts` is a pure function behind a
narrow interface. Story 06's sim can swap the implementation
without touching the rest of the bid flow.

---

## Appendix A — Sample bid preview (UI copy)

```
────────────────────────────────────────────────
  BID COMPOSER — Diogo Marques
  LW · Developing · Club Porto
────────────────────────────────────────────────

  Fee            [ At asking        ]
  Weekly wage    [ Notable          ]
  Signing bonus  [ None             ]
  Role promise   [ Important Player ]
  Loan           [ ○ Permanent  ● Loan ]

  [  Review & Submit  ]   [  Save as draft  ]
```

Not a word of "£" or "$". Tier words only.

## Appendix B — Sample rejection messages

```
WAGE_FLOOR      — "He expects a proper reward for a player at his level."
PLAYING_TIME    — "He wants more game time than this club can realistically offer."
FORBIDDEN_CLUB  — "He would not play for this club under any terms."
REGION_MISMATCH — "He is not willing to move to that part of the world."
SELLER_BUDGET   — "The selling club will not consider a move they cannot replace."
```

Each is ≤80 chars so the UI can render it in a `TierPill`-sized
container without wrapping awkwardly.

## Appendix C — Cross-story references

- **Story 03 (Scouting)** feeds knowledge graph certainty into the
  identity header on `/transfers/$playerId`. A Speculation-tier
  prospect looks Speculation in the composer header; a Certain one
  looks Certain.
- **Story 05 (Tactics)** consumes `PlayingTimeRole` from the
  contract to compute mood deltas when rotation drifts below the
  promise.
- **Story 06 (Sim)** writes match outcomes that change player form
  and therefore valuations.
- **Story 07 (Save slots + seasons)** adds transfer windows around
  the Story 04 machine. The existing state machine remains; only
  the window open/close guard is new.
- **Story 08 (Rogue-lite meta)** turns `cash_reserve_cents` into a
  real ledger with in-game events that transfer money.

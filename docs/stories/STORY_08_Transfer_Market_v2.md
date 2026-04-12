# RPG FC — Story 08

## Transfer Market v2: Market Value, Time, Competition & Finance

Story 04's transfer market was functional but flat — submit, resolve,
done. Story 08 replaces it with a dynamic market where bids take
match weeks to resolve, competing clubs can bid on the same player,
market values fluctuate with form and age, and clubs carry real cash
balances that constrain ambition.

---

## Story Metadata

| Field | Value |
|---|---|
| Story ID | RPGFC-08 |
| Phase | Phase 5 — Market Depth |
| Depends on | RPGFC-00 through RPGFC-07 |
| References | PRD §4.5, §8; TDD v2 §6 |
| Status | Ready for implementation |

---

## 1. Summary

Four connected upgrades to the transfer market:

### 1.1 Market value

Every player carries a visible **market value** expressed as a
qualitative tier (Minimal / Modest / Notable / Significant / Elite).
The value is a pure function of:

- **Position base** (strikers cost more)
- **Age curve** (peaks 23-28, declines after 30)
- **Recent form** (Excellent bumps, Dreadful drops)
- **Badge count** (more badges = more valuable)
- **Contract situation** (≤1 season remaining = cheaper)

The value is computed on every render, never stored — it moves as
the player plays. The scouting search page shows the value column
so the user can sort/filter by it.

### 1.2 Time-based resolution

Bids no longer resolve instantly. When submitted:

1. **Match week 0**: Bid enters `Submitted` state. A 4-match-week
   countdown starts.
2. **Match week 1-2**: The selling club evaluates and responds
   (accept / counter / reject). The response fires during the next
   `advanceMatchday` after the bid was submitted.
3. **If seller accepts**: The player evaluates within the next
   match-week advance.
4. **On agreement**: Contract materializes immediately, all other
   active bids on the same player are cancelled.
5. **On deadline (4 weeks)**: Unresolved bids expire automatically.

The `forceAcceptBid` dev endpoint still works for testing — it
bypasses the time delay and resolves instantly.

### 1.3 Competing bids

Multiple clubs can bid on the same player simultaneously:

- **AI club bids**: On each `advanceMatchday`, AI clubs with cash
  and a positional need submit bids on listed players. Simple
  logic: clubs with fewer than 2 players at a position and enough
  cash bid at the asking tier.
- **Bid activity indicator**: The scouting search and transfers
  page show which players have active bids from other clubs.
- **Poaching**: The user can bid on a player who already has
  competing bids. The seller picks the best offer.
- **On signing**: All other active bids on the same player are
  immediately cancelled with state `Cancelled`.

### 1.4 Club finances

Every club tracks a cash balance:

- **Starting cash**: Seeded by club reputation (Elite clubs start
  with more).
- **Transfer fee**: Deducted from buyer on signing, added to seller.
- **Wage bill**: Sum of all weekly contract wages. Shown as a
  qualitative tier on the squad page.
- **Budget pressure**: Clubs with high wage bills relative to their
  budget are more willing to sell.

The user's cash balance and wage bill are shown on a new
**Finance** row on the Squad page.

---

## 2. Technical Additions

### 2.1 Migration 0008

```
ALTER matches ADD COLUMN bid_deadline_week INTEGER;

ALTER bids ADD COLUMN submitted_match_week INTEGER;
ALTER bids ADD COLUMN deadline_match_week INTEGER;
```

Add `Cancelled` to the BidState union.

### 2.2 Market value function

```ts
// application/transfers/market-value.ts
function computeMarketValue(player, form, contract): {
  cents: number;
  tier: CurrencyTier;
}
```

Pure function. Called by the rendering layer. Never stored.

### 2.3 Bid ticker

```ts
// application/transfers/bid-ticker.ts
function tickBids(client, currentMatchWeek): {
  evaluated: number;
  expired: number;
  signed: number;
}
```

Called inside `advanceMatchday`. For each active bid:
- If submitted 1+ weeks ago and seller hasn't responded → evaluate
- If seller accepted and player hasn't responded → evaluate player
- If deadline passed → expire

### 2.4 AI bidding

```ts
// application/transfers/ai-bids.ts
function generateAiBids(client, currentMatchWeek): number
```

Called inside `advanceMatchday`. Each AI club scans listings and
submits bids based on positional need and cash.

### 2.5 Competing bid cancellation

When `signBid` fires for a player, all other active bids on the
same `player_id` are set to `Cancelled`.

### 2.6 UI changes

- **Scouting search**: new "Market value" column + "Has bids"
  filter
- **Transfers page**: each listing shows active bid count +
  market value
- **Bid status**: pending bids show a countdown ("resolves in N
  match weeks")
- **Squad page**: finance row (cash balance tier + wage bill tier)
- **/transfers/$playerId**: competing bid activity visible

---

## 3. Acceptance Criteria

**AC-01** — Market value is a pure function that changes with form.
**AC-02** — Bids submitted in match week 1 don't resolve until
advanceMatchday runs at match week 2+.
**AC-03** — Bids expire after 4 match weeks with no resolution.
**AC-04** — When one bid is accepted, all other bids on the same
player are cancelled.
**AC-05** — AI clubs submit bids during advanceMatchday.
**AC-06** — The scouting search shows market value and bid activity.
**AC-07** — Club cash deducts on signing and adds on selling.
**AC-08** — The finance row on Squad shows cash + wage bill tiers.
**AC-09** — All digits on new surfaces are allowlisted or absent.

---

## 4. Out of Scope

- Sell-on clauses, image rights, agent fees
- Player-initiated transfer requests
- Loan recall mechanics
- Wage negotiations separate from transfer bids
- Board approval / budget overrides
- Release clause triggers (stored but not evaluated)

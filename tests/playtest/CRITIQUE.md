# Playtest critique — RPG FC web UI

**Session:** fresh season 0, Club Madrid (club 1) as manager. Played through 5 match weeks, submitted one bid, rotated one squad role, changed formation, opened a match report.

**Goal frame:** attractive, intuitive, rich, data-driven, FM/FIFA-familiar, reflects the no-numbers doctrine.

**Verdict:** there's real craft in here — the match report, player profile, and club finances pages are already on-thesis. Navigation, density, and the home dashboard are not. This is NOT ready for external playtest. About 2–3 weeks of focused frontend work between "we can run a sim" and "someone outside the team would enjoy a weekend with it."

Screenshots: `/tmp/rpgfc-playtest/*.png`.

---

## Page-by-page

### ⛔ Home (`/`) — blocker
You land on a page titled "Walking Skeleton" with a "Backend Health" card showing the SQL dialect and build hash. That's a dev artifact, not a manager's cockpit. Should be a dashboard: **last result · next fixture · league position · mood barometer · key transfer/offer · budget at-a-glance · lead badge stories**. This is the most important page in the game and right now it's a diagnostic screen.

### ✅ Match report (`/matches/$id`) — the jewel
"Club Madrid 5 — 0 Unión Salvador". Drop-cap serif narrative ("An emphatic afternoon at the home ground…"), team summary, Opta-style per-player table under the Stats tab (Rating · G · A · SH · ST · Passes · Pass% · DRB · INT · TK · CL · AE · FC). Exactly the FM/FIFA density done in the house voice. **Ship this one.** Minor: the player-facing page has no link INTO here from the league fixtures list — a match just sits there with a green "W" badge but no way to click through. That's a missing affordance.

### ⚠️ League table (`/league`, Table tab)
Clean, allowlisted numerics (P/W/D/L/GF/GA/GD/Pts), correct fonts, tier-appropriate.
- **My club not highlighted.** I had to scan to find Club Madrid. Needs a club-stripe row marker.
- **No form column.** WWDLW chips are standard in every football UI and they pair with the no-numbers ethos perfectly (color = tier word).
- **No season context header.** "Season 0" is displayed; real users will expect "Season 1" (or "Season 2026", or a name).

### ⚠️ Fixtures (`/league`, Fixtures tab) — the fixtures list
- Good: scores shown, "Advance to next match week" button is front and center.
- **Fixtures don't link to their match reports.** This is the #1 gap — after you play a match you want to click in and read the story. Currently the W/D/L chip is just a decoration.
- Layout collapses to a narrow column on a 1440px viewport. Vast empty whitespace to the right.
- `?tab=fixtures` URL doesn't deep-link; only in-page click switches tabs. Breaks sharing and bookmarking.

### ⚠️ Squad (`/squad`) — data-starved
Players grouped by squad role. Each card shows name, position, archetype, mood chip ("Content — Playing the role we promised"), role dropdown.
- **Single-column cards on a 1440px viewport.** The page scrolls ~2400px tall while using ~40% of available width. Needs a grid or dense table mode.
- **No age, no contract length, no wage tier, no form** on the squad page — which is the manager's primary roster view. For a FIFA/FM user this is empty calories.
- Mood chip is great ("Content — Playing the role we promised") — keep that phrasing, it's the doctrine.
- Right inspector shows Harmony + 3 concerns. Good, but it's the only real data — feels like the insights all hide here.

### ✅ Club finances (`/club`, Finances tab)
Your own budget can show numbers per the doctrine (facts, not ratings) and this page uses them well: Cash Reserve $930.0M / Elite tier, Weekly Wages $504K / Elite tier, Weekly Budget $4.0M / Elite tier, Wage Budget Health chip "Healthy — 13% of budget used — You have room to sign more players without financial strain."
- **The dual labeling is redundant**: "$0 / Minimal tier" on spent-on-transfers says the same thing twice.
- **No time series.** "Ledger" tab shows transactions — a sparkline of weekly cash or wage curve would make this sing.
- **Wages are suspiciously large.** $504K/wk for 20 contracted players averages $25K/week/player, which is fine, but the $930M cash reserve and $4M weekly budget are implausible for club finance at this level. Either the asking prices are wildly inflated or starting cash is. (I flagged this before — it's a seed/valuation calibration issue, not a UI bug.)

### ⚠️ Club ledger (`/club`, Ledger tab)
`?tab=ledger` doesn't navigate (duplicate screenshot with finances). Tab must be clicked. Content likely empty on week 1. Not verified.

### ⛔ Scouts (`/scouts`) — layout broken at 1440px
The page is a filter bar + big table with 9 filters (name, position, nationality, club, experience, certainty, form, badge, foot). On my viewport it renders as a cramped narrow column where the filters collide with each other and the table is unreadable. **Looks like a responsive breakpoint issue** — desktop is getting a mobile layout. Confirmed by file size: 1.3MB for scouts vs 43KB for home (very long page, little info per pixel). Needs layout inspection.

### ⚠️ Transfers (`/transfers`) — tabs don't deep-link
- 5 tabs: Market / My Bids / Offers / Watchlist / Completed. `?tab=my-bids` etc. don't switch tabs; only clicks do.
- Market shows listings with asking tier (Modest/Notable/Significant), selling club, age, position. Usable, narrow column.
- **No sorting or filtering in the market view.** For a football sim you need "show me midfielders Notable-or-below who are under 26." Scouts has that (sort of); market should too.
- **Watchlist/Offers/Completed are invisible on day 1.** Need empty-state coaching ("No offers yet — other clubs will approach you when your players catch their eye.").

### ✅ Transfer composer (`/transfers/$playerId`)
Clean split: left shows the player (name, archetype one-liner, asking tier, badge chips grouped by category). Right shows the offer form (Fee / Weekly Wage / Signing Bonus / Role Promise dropdowns, Permanent/Loan radio, Submit). Submit produces a "Submitted" chip. Dev-only "Force accept" is visible to devs.
- **No buyer-side context.** "Current wage" of the target should be shown so you can calibrate; "your club budget impact" at the chosen tiers would stop you from blowing cash accidentally.
- **No acceptance-likelihood preview.** At Modest fee for a Modest asking player this should feel likely; at Minimal for Notable it should visibly warn. Currently nothing.
- **No contract length on bid.** Role promise is there but years/seasons are not, which makes "3-year deal" vs "5-year deal" impossible to offer.

### ✅ Tactics (`/tactics`)
Pitch diagram with LW/RW/ST/CM/CM/CDM/LB/CB/CB/RB/GK slots. Right panel: Formation / Playing Style / Team Instructions (8 toggle chips, 2 active). Save/Reset buttons at bottom.
- **Slots are empty.** Names aren't assigned. FM would show the starting XI glued to slots with names and drag targets.
- **No "upcoming fixture" context.** Tactics should be tuned against next opponent — this page is disconnected from the match calendar.
- **No chemistry / coherence signal.** You just pick a style — nothing says "this formation + this squad = cohesive" vs "mismatched." That's a perfect no-numbers surface (a qualitative chip: "Cohesive" vs "Experimental").

### ✅ Player profile (`/players/$id`) — almost there
On-thesis. Age, position tag, nationality, "Known Unknown" certainty, mood chip, archetype prose one-liner, Overview tab showing form prose + badges grouped by category + Facts. Tabs: Overview/History/Badges/Relationships/Contract/Reports.
- **"Known Unknown"** reads weird. Should be "Knowledge: Unknown" or "Certainty: Unknown."
- **History/Badges/Relationships are "Coming soon" stubs.** These are exactly the tabs a manager opens first. History especially — seeing "he scored 10 in S2, 7 in S3" is the story of a rogue-lite.
- **No form chart on the Overview tab** (from the critique map). Sparkline with tier words on the y-axis would fit the doctrine perfectly.
- **No "my interest" controls.** No watch/scout/bid buttons — you have to navigate back to Scouts to act on what you just read. Breaks the read→act loop.

### ⚠️ Players list (`/players`)
40-player vertical list, 40-item limit, paginated. Narrow column. No in-page filter (Scouts duplicates it). Purpose unclear — probably redundant with Scouts.

### ⚠️ Club detail (`/league/clubs/$id`)
**This one is surprisingly good.** Continental Club tier, Cash Reserve / Weekly Wage Bill / Roster Size cards (all tier words for non-self clubs), a 20-row roster table with Player/Pos/Age/Role/Wage tier/Years/Form, on a single screen.
- **No recent form.** The form column exists but renders blank early in the season.
- **No recent results** at the club level.
- **No manager / stadium / founded year** to give each club flavor.
- **No "bid on their player"** affordance directly from the row.

---

## Cross-cutting issues

### 1. Width utilization is broken on desktop
Most pages render at ~40–60% of a 1440px viewport. The doctrine wants Newsreader at `max-w-prose` for narrative (match report: correct), but squad/market/fixtures pages are lists, not prose, and should use the full canvas. Audit Tailwind `max-w-*` usage across routes and split "prose pages" from "data pages."

### 2. Tabs don't deep-link
`?tab=…` query params don't drive the tab state. Every tabbed page (League, Club, Transfers, Player profile) needs URL-synced tabs via TanStack Router `search` params. Breaks bookmarking, breaks browser-back, breaks sharing.

### 3. "My club" isn't visually distinguished anywhere
League table, fixtures list, market — none highlight the club you manage. Even a 2px `--club-stripe` left border on the row would do it.

### 4. Dead-ends between pages
You can't click a fixture → match report. You can't click a player on a club roster → their profile (unverified but implied by the lack of links). You can't click a player profile → "bid on them." The whole thing is siloed by route, which kills the exploration loop.

### 5. Season context is underselling
"Season 0" is a dev-ish label. In-game framing should be "Season 2026" or "Year 1" or similar, and the match-week counter should be persistent in the top chrome ("S1 · MW 5" style pinned badge next to the nav).

### 6. Hardcoded "club 1"
Several web files check `player.club?.id === 1` to decide whether to show manager controls (extend contract, etc.). The `MANAGED_CLUB_ID` env var hooks the server but not these UI checks. Any club-2+ manager attempt will hide the controls. Needs an `/api/me` endpoint or a client-side config seeded from the server.

### 7. The numbers on your own budget are real but the scale is off
$930M cash, $4M/week budget — this reads more like "World's Richest Club" than "Club Madrid starting season 1." Either the seed scales down, or the display calibrates (show in "millions of euros" with a sane y-ceiling).

---

## Priority fixes (rough estimates)

| # | Fix | Effort | Impact |
|---|---|---|---|
| 1 | Home dashboard: last result / next fixture / table position / mood / budget | 1 day | High — it's the first page |
| 2 | Fixtures row → match report link | 15 min | High — missing exit to the best page |
| 3 | Deep-link tabs via URL search params (League, Club, Transfers) | half-day | Medium — UX predictability |
| 4 | Highlight my club across table/fixtures/market | half-day | Medium — orientation |
| 5 | Scouts page layout at ≥1024px (filter row + table grid) | half-day | High — search is broken today |
| 6 | Squad page: adds age + contract length + wage tier + form chips | half-day | High — roster is the manager's home |
| 7 | Player profile: wire History/Badges/Relationships tabs | 1–2 days | Medium — unlocks the rogue-lite narrative |
| 8 | Transfer composer: buyer budget impact + acceptance-likelihood chip | half-day | Medium — reduces guessing |
| 9 | `MANAGED_CLUB_ID` into web: replace the `=== 1` hardcodes | 2–3 hrs | Medium — enables real playtest variety |
| 10 | Club name highlighting + form column on league table | 1 hr | Low-effort polish |

---

## What I'd NOT change

- Match report (keep the drop-cap, keep the stats table, keep the prose)
- Player profile header (name + role + archetype line + mood chip — chef's kiss)
- Wage Budget Health chip (great doctrine exemplar)
- Tactics instruction chips (good affordance)
- Color palette and typography (parchment + Newsreader + JetBrains numerals is working)

## Ready for external playtest?

No. The home page alone is blocking — first impression reads as "this is a tech demo." Plus Scouts layout is broken at desktop width. Targeting an external playtest: finish items 1–6 above and the product is playable enough to collect real feedback. Items 7–10 can follow in the first iteration after the first playtest round.

---

## Session 2 — end of season + rollover into season 1

Continued from match week 6, clicked Advance 13 more times to finish MW 18, then End Season, then toured season 1.

**How my season went:** Club Madrid (me) finished **7th of 10** with 24 pts (7W-3D-8L). Real Oviedo champion at 43 pts. Lost my opening bid (Diego Herrera, Modest fee) to `SELLER_REJECTED`. Ended with $2.5B cash (up from $930M) from TV / sponsorship / matchday revenue. Youth intake dropped 3 age-17 players into my roster at rollover.

That's actually a plausible RPG-style narrative — hot start, late collapse, missed a target, end up mid-table. But the UI tells you none of it.

### New findings

#### ⛔ Season-end ceremony is one sentence, easy to miss
`endSeason` returns a `narrative` field and the league page renders it as an italic line inside a plain parchment box. No "CHAMPIONS" banner for Real Oviedo, no medal/trophy moment, no position celebration. I missed it on my first screenshot because the rest of the page (fixtures) had already re-rendered for season 1. For a rogue-lite where the *story* is the product, season-end should be a dedicated ceremony route — champion hero page + your-club summary + top scorer + season review + rollover button.

#### ⛔ Season 1 home = season 0 home
Literally identical. "Walking Skeleton / RPG FC / Backend Health" on day 1 of a new era. The manager's sense of continuity and accomplishment depends on this page acknowledging that a season happened. Even a one-liner "Last season: finished 7th. New season starts now." would transform the vibe.

#### ⛔ Season 1 league table sorts alphabetically/by-id
Ten clubs, all zeros, order = Club Madrid, Sporting Recife, AC Barcelona, Racing Porto Alegre… That's club-id order, not last-year-finish. A football UI should at minimum show last-season position (either via `#`-ranking persistence, a small "7th last season" marker, or a toggle to view prior standings).

#### ⛔ My bid history is invisible after it resolves
Diego Herrera bid went to `SELLER_REJECTED`. Zero UI surface for this. `/transfers?tab=my-bids` doesn't URL-switch (known issue) but even if you navigate in, rejected historical bids are the *most narratively interesting* thing — "the one you missed" is the classic manager memory. Surfacing: a rejected-bid card with the seller's (paraphrased) reason and a "Try again" button.

#### ⚠️ Youth intake is invisible
3 age-17 players joined my academy. UI says nothing. Squad page doesn't show ages or flag "new arrival". The rogue-lite hook "can I develop this kid into something?" is lost if the kid is indistinguishable from the other 25 players on the list. Needs:
1. A "new arrivals" banner on the Squad page at season start
2. An "age 17" chip on their squad cards
3. A season-1 home card: "Your academy took in 3 new players this summer"

#### ⚠️ Finance counters reset silently
"Spent on Transfers: $0" in season 1. This is correct-ish (per-season counter) but provides no memory of season 0's activity. Need a yearly rollup in the Ledger tab: "Season 0 — Revenue $X / Wages $Y / Transfers $Z / Net $W."

#### ⚠️ No match report link from fixtures (reconfirmed)
Ran `full-season.ts` which tried to click a match link from `/league` — 0 found. The fixtures list shows W/D/L chips but they're decorative. This is THE #1 UX crime because match reports are the best page in the app.

#### ⚠️ Scouts layout still broken at 1440px after season rollover
No regression from the Session 1 finding — confirmed it's a page-level layout issue not a data-dependent one.

### What's working after a full season
- ✅ **Fixtures deterministically completed.** 18 match weeks, 90 matches all played, no errors.
- ✅ **End-season button visible** and functional — the state machine knows when the season is done.
- ✅ **Cash reserve incremented sensibly** via finance events during the season (TV/sponsor/matchday).
- ✅ **Contract seasons decremented** via endSeason (wages dropped $504K → $448K as some contracts rolled or players retired).
- ✅ **Age ticked up by 1** for everyone.
- ✅ **Youth intake happened** (3 new age-17 players per club).
- ✅ **Retirement fired** (no 38+ contracted players at my club after rollover; max age 33).

The backend is doing its job. The frontend is under-narrating it.

### Updated priority list (session 1 + 2 combined)

| # | Fix | Effort | Impact |
|---|---|---|---|
| 1 | Home dashboard with last result / table / mood / budget / next fixture | 1 day | Blocker |
| 2 | Season-end ceremony page (champion + your summary + rollover) | 1–2 days | Blocker for game feel |
| 3 | Fixture rows → match report link | 15 min | Blocker |
| 4 | Scouts desktop layout repair | half-day | Blocker |
| 5 | My Bids page surfaces resolved bids with paraphrased reasons | half-day | High |
| 6 | Last-season-position memory on league table | 2 hrs | High |
| 7 | Youth intake surfacing: squad banner + new-arrival chips | half-day | High |
| 8 | URL-synced tabs across League / Club / Transfers | half-day | Medium |
| 9 | Highlight my club on table / fixtures / market | half-day | Medium |
| 10 | Yearly rollup in Club Ledger | 2 hrs | Medium |
| 11 | Squad page adds age + contract length + wage tier + form chips | half-day | Medium |
| 12 | Player profile: History / Badges / Relationships tabs | 1–2 days | Medium |
| 13 | Transfer composer: budget impact + acceptance-likelihood chip | half-day | Medium |
| 14 | `MANAGED_CLUB_ID` plumbed into web to drop the `=== 1` hardcodes | 2–3 hrs | Medium |
| 15 | Form column on league table | 1 hr | Low |

Items 1–4 are the minimum to attempt an external playtest. Items 5–7 are the minimum to make season 2 feel like it's a continuation of season 1. The rest are polish.

### Bottom line

The **game mechanically works across season boundaries**. Matches play, ages tick, youth enter, finances grow, contracts expire, standings produce a clear champion. The **UI doesn't tell a story about any of it.** For a rogue-lite where the thesis is "show me the player, kill the number," the equivalent unaddressed gap is "show me the season — kill the table sort." Fixing the narrative surfaces is the next big unlock.

---

## Session 3 — Season 1 play with corrections to earlier findings

Rebooted against `playtest.db` (still in S1 MW1 after the S0 rollover). Submitted 3 bids at Notable fee/wage (Iker Navarro → 500 error, Finn van Houten, Vinícius Costa). Extended Iván Fernández's contract. Advanced 6 match weeks. Took viewport-only screenshots (prefix `vp-*.png`) — these capture what a user actually sees without scrolling.

**S1 progress so far:** Club Madrid 7th after 6 MW, 2W-0D-4L, 6 pts. Real Oviedo 1st (15 pts). Consistent with S0 — I'm struggling to compete.

### Corrections to session 1 critique

#### ✅ Scouts page is NOT broken — I was wrong
At viewport (not fullPage), Scouts renders beautifully: filter grid at top (Name, Position, Nationality, Club, Experience, Certainty, Form, Badge Type, Foot), Clear-filters link, table with Player / Pos / Club / Nat / Value / Experience / Certainty / Badges / (bid button). See `vp-scouts.png`. The earlier "broken" finding was an artifact of reading a 1440×8618 fullPage capture at shrunken scale — all 200 players rendered as a long scroll. The page itself is dense and correct. **Remove "Scouts desktop layout repair" from priority list.**

#### ✅ My Bids DOES surface resolved bids — I was wrong
`/transfers` → My Bids tab shows a "Resolved (3)" list with cards per bid:
- **Vinícius Costa — CANCELLED** (italic)
- **Finn van Houten — PLAYER DECLINED** (chip)
- **Diego Herrera — REJECTED BY CLUB** (chip)
The S0 bid persists into S1, which is right. See `45-my-bids-s1.png`. The remaining gap is that **no reason is paraphrased** — "Player Declined" doesn't say *why* ("he wanted to move elsewhere in the region"). That's a smaller fix than I thought. **Downgrade the priority to "Medium — paraphrase the rejection reason + add a Re-offer button"**.

### New findings from Session 3

#### ⛔ HTTP status codes leak to the user
Extending Iván Fernández's contract produced this inline message:
> *The player rejected the offer: extend-contract failed: 409*
That `409` is an HTTP status code. The user shouldn't see that. Wrap the error path to produce "The player turned down our offer — try a better wage or a shorter deal" (or use the player's preference signal if known).

#### ⛔ 500 Error when bidding on a player with no current club
Bid 1 targeted player id 8 who is apparently a free agent (listing exists from old state but the player was released). Server responded 500 with "Player has no current club" and the UI showed a `[pageerror] bid submit failed: 500` console error but no user-visible message. Either: (1) filter free-agent-but-still-listed entries out of `/api/listing`, or (2) short-circuit in `submitBid` with a proper 400 and a friendly inline error.

#### ⚠️ Contract tab's "1 SEASONS LEFT" plural bug
Should be "1 SEASON LEFT". Tiny but it jumps out.

#### ⚠️ Contract extension had no visible round-trip acknowledgement of success
I extended Iván Fernández. The server accepted it (DB shows new `signed_at`). The UI on success produced no confirmation chip, no updated "SEASONS LEFT" in the card header. I only know it happened because I checked the DB.

#### ⚠️ `/saves` page makes slot-switching require a server restart
Good, honest prose caption: "To load a different slot, restart the server with a different DATABASE_URL." For a rogue-lite where trying multiple runs is the core loop, that's punishing. In-app slot switching (via a `/api/saves/load` route that swaps the DB connection) would unlock real playtesting.

#### ⚠️ Reports tab has a great empty state — but the feature behind it isn't wired
> *No scout reports yet. Send a scout to a Player Focus assignment to start building knowledge of this player.*
Exactly the right copy. But there's no UI route to actually assign a scout — no `/scouts/assignments` page visible in the primary nav, just a `/scouts` player-search. So the CTA is a dead-end.

### Corrections: what's ACTUALLY working that I missed
- ✅ Contract extension form is clean (Weekly Wage / Signing Bonus / Seasons / Role Promise dropdowns, clear "Offer Extension" button)
- ✅ Player profile Contract tab shows: permanent-contract card with seasons left (BIG number, allowlisted), wage tier, bonus tier, role promise. Readable and on-thesis.
- ✅ My Bids resolved cards with status chips (CANCELLED / PLAYER DECLINED / REJECTED BY CLUB) — good, just needs reason paraphrases.
- ✅ Scouts page rendering at 1440 viewport is dense and well-organized.
- ✅ Saves page lists all slots and explains how to switch (honestly).

### Updated priority list after Session 3 corrections

| # | Fix | Effort | Impact |
|---|---|---|---|
| 1 | Home dashboard | 1 day | Blocker |
| 2 | Season-end ceremony page | 1–2 days | Blocker for game feel |
| 3 | Fixture rows → match report link | 15 min | Blocker |
| 4 | ~~Scouts desktop layout~~ — **removed, I was wrong** | — | — |
| 5 | Wrap error messages (no HTTP status codes in UI) | half-day | Blocker for external playtest |
| 6 | Filter free-agents out of `/api/listing` OR 400 at submit | 1 hr | High |
| 7 | My Bids — paraphrase rejection reason + Re-offer button | half-day | High |
| 8 | Last-season-position memory on league table | 2 hrs | High |
| 9 | Youth intake surfacing (squad banner + age chips) | half-day | High |
| 10 | URL-synced tabs | half-day | Medium |
| 11 | Highlight my club across lists | half-day | Medium |
| 12 | Yearly rollup in Club Ledger | 2 hrs | Medium |
| 13 | Squad page: add age + contract + wage + form | half-day | Medium |
| 14 | Player profile: History / Badges / Relationships tabs | 1–2 days | Medium |
| 15 | Transfer composer: budget impact + acceptance preview | half-day | Medium |
| 16 | `MANAGED_CLUB_ID` → web config (drop `=== 1` hardcodes) | 2–3 hrs | Medium |
| 17 | Contract extension success feedback (chip + live seasons-left update) | 1 hr | Medium |
| 18 | In-app save slot loading | half-day | Medium |
| 19 | Scouting assignment UI (wire the Reports CTA) | 1 day | Medium |
| 20 | Form column on league table | 1 hr | Low |
| 21 | "1 SEASONS LEFT" → "1 SEASON LEFT" plural fix | 5 min | Low |

The blocker set for external playtest is now: **Home dashboard, Season-end ceremony, Fixture → match link, Error message wrapping**. Four things, roughly 3 days of work.

### Three-session bottom line

**The product's bones are solid.** The mechanics cross season boundaries cleanly. The doctrine is intact (no numbers leak on player surfaces, tier words working, parchment+Newsreader+mono looking right, Opta-density match stats in a serif frame, contract management one-click-away from every profile).

**What's missing is narrative connective tissue.** The backend produces events — championships, collapses, bid rejections, youth arrivals, retirements — and the frontend doesn't stitch them into a story. The manager never feels the season-end moment. The new-season opener feels identical to the first boot. The failed bid has no paraphrase to hurt or instruct. The home page is a diagnostic.

Fix those story surfaces and the game clicks. Everything else on the priority list is a polish pass.

---

## Session 4 — finish S1, enter S2, probe Offers/Watchlist/rival clubs

Pushed through S1 MW7 → end-of-season, clicked End Season, entered S2, added a Watchlist entry, drilled into Real Oviedo's roster, opened a rival player profile, and played 3 MW of S2.

**S2 after 3 MW:** AC Barcelona 1st (7 pts), Real Oviedo 2nd, **Club Madrid 3rd** (6 pts, 2W-0D-1L). First real sign that competitive balance shifts across seasons — Real Oviedo's stranglehold broke. The merit-wins-eventually thesis is alive in the data.

### New bugs found (real, not UX)

#### ⛔ Fixtures view mixes matches across all seasons
`packages/server/src/rendering/fixtures-response.ts:31` — `loadAllMatches` has no season filter. `/api/season/fixtures` groups by matchday only, so after a rollover the S2 MW1 fixtures (5 matches) are concatenated with the S1 MW1 results (5 matches) under the same "Match Week 1" header. The list ends up double-length with every fixture appearing twice. This is visible on the Fixtures tab as two cards per matchup.
**Fix:** add `WHERE season = ?` and accept the current season via `save_state`.

#### ⛔ Offers tab is mislabeled and unusable
`/transfers?tab=offers` shows 7 rows, all "Mats de Boer · Bid from Club Madrid · PENDING / PLAYER DECLINED". Mats de Boer is MY player (Club Madrid). Either the query is returning my OWN bids here (wrong endpoint), or the tab IS showing incoming offers but labels the seller as the "from" club instead of the buyer.
**Fix:** audit the API — Offers should show bids where `b.to_club_id = myClubId`, with the row's "from" = buyer's club name.

#### ⛔ Watchlist lets you watch your own players
Clicked Watch on the first Scouts table row — that row happened to be Iván Fernández, a Club Madrid player. He now sits in my Watchlist with a BID button. Clicking that would attempt to bid on my own player, which the backend rejects with "Cannot bid on a player already at your club" (from `submitBid`). The Watch button should be hidden/disabled for my own squad.

#### ⚠️ End-season narrative still not visible
Clicked End Season, waited 2.5s, took two screenshots — the only thing visible was the fixtures list scrolled mid-page. The narrative card is rendered but probably above the fold and requires scroll. Either auto-scroll to it, or render it as a modal/dialog, or route to a dedicated ceremony page.

### Corrections: things I was wrong about (again)

#### ✅ Fixtures DO link to match reports
Previous session script looked for `a[href^="/matches/"]` and found 0 — that selector missed relative hrefs. This session used `a[href*="/matches/"]` and found **180 match links** (10 clubs × 18 MW = 180, correct). So clicking a played match DOES navigate to its report. My earlier "#1 UX crime" ranking was wrong — **remove "Fixture rows → match report link" from the priority list.**

#### ✅ The read-to-act loop *partially* works: Watch button exists on Scouts
Every row in the Scouts table has a Watch button. Not on the player profile page itself, but you can hop from Scouts → Watch → Watchlist (minus the own-player bug).

#### ⚠️ What's still broken on the read-to-act loop
- **Rival player profile has NO action buttons.** After drilling into /league/clubs/7 (Real Oviedo) → clicking their player → rival profile loads — but there's no Watch, no Bid, no Scout-assignment button. You have to back out to Scouts and search by name again.
- **Club detail roster links to player profile** (13 profile links on Real Oviedo's page) — good, that's a bright spot.

### Pleasant surprise: Season 2 competitive shift

After S0 and S1 both won by Real Oviedo at 43 pts, S2 through 3 MW shows:
- AC Barcelona 7 pts (1st)
- Real Oviedo 7 pts (2nd on goal difference)
- Club Madrid 6 pts (3rd)

It's still early, but the fact that the top changed hands at all suggests the roster-churn system produces varied outcomes. Good signal for the merit thesis.

### Updated priority list after Session 4

| # | Fix | Effort | Impact |
|---|---|---|---|
| 1 | Home dashboard | 1 day | Blocker |
| 2 | Season-end ceremony (route or auto-scroll to narrative) | 1–2 days | Blocker |
| 3 | Wrap errors (no HTTP codes in UI) | half-day | Blocker |
| 4 | **Fixtures: filter by season** (real bug) | 30 min | Blocker |
| 5 | **Offers tab: fix label/query** (real bug) | 1 hr | Blocker |
| 6 | Free-agent listing → prevent bid (real bug) | 1 hr | High |
| 7 | Watchlist: skip own-club players | 30 min | High |
| 8 | My Bids: paraphrase rejection reason + Re-offer | half-day | High |
| 9 | Last-season-position memory on league table | 2 hrs | High |
| 10 | Youth intake surfacing | half-day | High |
| 11 | Rival player profile: add Watch / Bid / Scout buttons | 1 hr | High |
| 12 | URL-synced tabs | half-day | Medium |
| 13 | Highlight my club across lists | half-day | Medium |
| 14 | Yearly rollup in Club Ledger | 2 hrs | Medium |
| 15 | Squad page: age + contract + wage + form | half-day | Medium |
| 16 | Player profile: History / Badges / Relationships tabs | 1–2 days | Medium |
| 17 | Transfer composer: budget + likelihood | half-day | Medium |
| 18 | MANAGED_CLUB_ID → web | 2–3 hrs | Medium |
| 19 | Extension success feedback | 1 hr | Medium |
| 20 | In-app save switch | half-day | Medium |
| 21 | Scouting assignment UI | 1 day | Medium |
| 22 | Form column on league table | 1 hr | Low |
| 23 | "1 SEASONS LEFT" plural fix | 5 min | Low |

Net: **5 blockers**, sized at ~4 days total. Items 4 and 5 are new real backend bugs I surfaced by playing through a rollover.

### Three-season summary

I've now managed Club Madrid across S0 (7th), S1 (finished, didn't capture exact finish), and S2 MW1-3 (currently 3rd). Made 4 bids total (1 sellerRejected S0, 2 playerRejected/cancelled S1, 0 signed). Tried 1 contract extension (rejected, $409 leaked to UI). Squad churned only from retirements and youth intake — I never landed a signing.

A human manager with the same experience would walk away frustrated about the *lack of narrative feedback* (no "here's your season" moments, no "here's why the player said no" coaching), not about the game's raw mechanics. Which means: **the systems are doing enough. The narration isn't.**

---

## Session 5 — S2 finish, S3 open, the accidental redemption arc

Pushed through S2 (15 more advances to end), clicked End Season, opened S3, played 3 MW.

### The Club Madrid story so far

| Season | Finish | Points | Note |
|---|---|---|---|
| S0 | 7th | 24 | Hot start, late collapse, lost my only bid |
| S1 | ? | ? | Didn't capture — probably mid-table |
| S2 | **3rd** | 33 | Climbing. Real Oviedo dethroned by Racing Porto Alegre |
| S3 MW3 | **1st** | 9 (3W-0D-0L) | Leading the league — with 13 players, 9 of them teenagers |

This is unintentionally a great rogue-lite arc. I never landed a single transfer. I just let the roster age, let the youth arrive, and watched the seasoned league collapse around me. Three seasons in, my squad is 9 teenagers + 4 early-20s, and we're top of the league. That's actually a compelling story if the UI told it.

### New findings

#### ⛔ Squad collapsed to 13 players — UI didn't warn me
`SELECT COUNT(*) FROM players WHERE club_id=1` returns 13 — below `MIN_ROSTER_SIZE = 18` from my strategy work. The manager-mode UI doesn't warn about this. No banner, no red number, no "you need 5 more players to field a full matchday squad." The DB tells the story; the UI hides it.

**Fix:** Squad page should flag roster-size breaches with a red "Critical" chip at the top. Club Finances page should show roster count alongside wages.

#### ⛔ Fixtures duplication compounds across rollovers (confirmed real)
Session 4 found the bug (S0+S1 mixed). Session 5 confirms it's additive — S3's Fixtures tab shows 3× duplicates for every MW1 match. After 5 seasons this list will be 5× long. Server fix: filter by season in `renderFixturesForUser`. Takes 30 min.

#### ⛔ End-season narrative is truly invisible
Clicked End Season, scrolled the page to top (`window.scrollTo(0,0)`), waited 500ms, snapped — narrative card absent. What's there: the new S3 fixtures list. Either the narrative card only renders while `endSeasonMutation.data` is hot and our goto refreshed the page (likely), OR it renders above the tabs and the tabs scroll separately. Either way, the user who clicks End Season gets ZERO celebration and ZERO confirmation, just silent progression to S3. This is the worst UX surface in the product right now.

**Fix:** After endSeason mutation resolves, route to a dedicated `/season/summary` page (or open a modal) with champion hero + your-finish + top scorer + rollover button. Don't rely on a mutation-state-scoped inline card.

#### ⛔ Home page STILL identical across 4 seasons
S0, S1, S2, S3 — same "Walking Skeleton / RPG FC / Backend Health" screen. Four seasons in, my club is 1st in the league and my home page is a diagnostic. This was session 1's #1 finding and it's still the #1 finding. Won't be ready for external playtest until this is a real dashboard.

#### ⚠️ Wage bill collapsed silently
Club finances:
- S0 start: $504K/wk
- S1 start: $448K/wk
- S3 start: **$70K/wk**

That's an 86% wage drop across 3 seasons. The ledger presumably shows the events but nothing flags "you have lost 12 contracted players to expiry and retirement — budget health Excellent, roster health Critical."

#### ⚠️ League table still re-sorts by club-id on season start
S3 table pre-play: Club Madrid 1st, Sporting Recife 2nd, AC Barcelona 3rd — that's club-id order, not last-year finish. After MW3 it resorts by points.

### Corrections / reconfirmations

- ✅ **League CAN change hands.** S0–S1 Real Oviedo → S2 Racing Porto Alegre → S3 (so far) Club Madrid leading. The merit-and-variance thesis produces real variety.
- ✅ **Competitive balance keeps shifting.** S2 champion Racing Porto Alegre now sits 7th after 3 MW of S3. Dominance isn't persistent. That's the design goal.
- ❌ **My bids still never signed.** 4 bids across 3 seasons, 0 completed transfers. Either my fees were still too low (despite bumping to Notable), or the sellers' thresholds are hard to hit, or my click-path isn't setting the seasons count correctly on submit. This is the bug I'd investigate next if I were making fixes.

### The real critique after 4 sessions of play

Having played across 4 seasons, I can say this with confidence:

**The backend is producing a legitimate rogue-lite arc.** My club has been through a story — bad start, slow climb, squad collapse to youth, now leading. That's *exactly* the kind of narrative the product is selling.

**The frontend is refusing to acknowledge the arc.** The home screen says the same thing in S3 MW3 that it said in S0 MW1. The league table treats every new season like a fresh install. The season-end event produces nothing visible. The wage-bill-collapse and roster-collapse events are silent. The "here's the story the game just told you" surfaces simply don't exist yet.

### Final cumulative priority list

Collapsed and re-ordered by effect-on-playtest-readiness:

**Must fix before external playtest:**

1. **Home dashboard** (1 day) — first thing a user sees
2. **Season-end dedicated route** (1 day) — first time a user clicks End Season they should feel the moment
3. **Fixtures: filter by season** (30 min) — real bug, compounds each rollover
4. **Offers tab: fix query** (1 hr) — real bug, shows wrong data
5. **Error message wrapping** (half-day) — HTTP codes in UI
6. **Roster-size warning** (1 hr) — player can collapse their squad silently today
7. **Free-agent listing filter** (1 hr) — 500 error path

**Strongly recommended for game feel:**

8. Last-season finish memory on league table (2 hrs)
9. Youth intake surfacing — squad banner + new-arrival chips (half-day)
10. My club highlight across lists (half-day)
11. URL-synced tabs (half-day)
12. Rival player profile: Watch / Bid / Scout buttons (1 hr)
13. My Bids: paraphrase rejection reasons + Re-offer (half-day)
14. Watchlist: skip own-club players (30 min)
15. Squad page: age + contract + wage + form columns (half-day)
16. Contract extension success feedback (1 hr)

**Polish (do after first external playtest):**

17. Player profile History / Badges / Relationships tabs (1–2 days)
18. Transfer composer: budget impact + likelihood chip (half-day)
19. MANAGED_CLUB_ID → web (2–3 hrs)
20. In-app save switch (half-day)
21. Scouting assignment UI (1 day)
22. Yearly rollup in Ledger (2 hrs)
23. Form column on league table (1 hr)
24. Plural fix "1 SEASONS LEFT" (5 min)

**Total blocker set: ~3–4 days of frontend work.**

After those land, the playtest experience would go from "tech demo with a sim running behind it" to "rogue-lite football season that actually tells you a story."

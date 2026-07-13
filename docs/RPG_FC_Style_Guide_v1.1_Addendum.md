# RPG FC Design & Style Guide — v1.1 Addendum

Status: canonical. Extends the v1.0 Style Guide (`RPG_FC_Design_and_Style_Guide.docx`).
Where this addendum and v1.0 conflict, the addendum wins. Motivated by the
2026-07-13 playtest audit: the app under-implemented v1.0 (color budget unspent,
Inspectors and inline form strips missing) and v1.0 had no guidance for
illustration, the turn loop, empty states, or ink contrast — the combination
read as an undifferentiated beige template rather than a match programme.

---

## 13. Ink & Contrast (amends §1.1, §2.1)

The match-programme metaphor was incompletely applied: a broadsheet is not
uniformly cream — it has a **dark ink masthead**, heavy headline ink, and
cream paper *between* the ink. Tan-on-tan-on-tan is a failure mode, not
restraint.

- **13.1 The Masthead.** The global navigation shell is printed in ink:
  `parchment-900` background, `parchment-100` text, active destination in
  `moss-400` with the 2px underline. The 4px club stripe sits above it at
  full saturation. This is the single largest dark surface in the app and
  the anchor that makes every cream page read as paper instead of beige.
- **13.2 Ink bands.** Nameplates over hero art, the persistent action bar
  (Editor archetype), and section-divider bands on ceremony surfaces may use
  `parchment-900` fills with light text. Limit: at most one ink band inside
  the content area of any screen; the masthead does not count.
- **13.3 Spend the color budget.** Every screen should contain at least one
  deliberate accent spend: the primary action (moss fill), the club stripe,
  tier-tinted chips, or the form gradient in data. A screen with zero accent
  spends is a bug in composition, not minimalism. (The budget cap in §1.1
  still applies — one primary action, accents earn attention because they
  are scarce, not absent.)
- **13.4 Surface separation.** Page canvas stays `parchment-50`. Cards are
  reserved for interactive or highlighted units; reference content sits flat
  with hairline rules. When everything is boxed, boxes stop meaning anything.

## 14. Illustration & Art System (new)

All generated art is one editorial system: monochrome charcoal/conté on
toothed paper, rendered by the pinned image model from the prompts in
`packages/server/src/scripts/generate-player-art.ts`.

- **14.1 Asset classes.** Player portraits (1:1 masters, shown through
  PlayerCard 4:3 and circular avatar crops); hero panels (exactly 2048×896,
  16:7, lower quarter compositionally quiet for the nameplate overlay);
  future editorial spots (8:5) for narrative letters.
- **14.2 Treatment.** Every placed image gets the unifying treatment:
  `sepia(0.12–0.15) contrast(1.05) saturate(0.85)` with `mix-blend-multiply`
  over a parchment surface. Art is never displayed raw.
- **14.3 Identity is sacred.** A portrait may only appear for the player it
  was generated for (world-seed-scoped keys; `player-art/manifest.json`
  records provenance). A player without a portrait shows the anonymous
  back-turned silhouette for their position family — never another player's
  face, never a placeholder that implies knowledge. Silhouettes are the
  *designed* unknown state, echoing the scouting pillar.
- **14.4 Where art belongs / doesn't.** Belongs: Home hero, match reports,
  ceremonies, player cards/avatars, narrative letters. Doesn't: league
  tables, finance surfaces, editors, charts — those are carried by
  typography, crests, and ink.
- **14.5 Club crests are code, not images.** `ClubCrest` (flat SVG shield,
  club primary + secondary band + name monogram, 1px ink border) is the
  club identity mark on rows, fixtures, and headers. Never generate crest
  imagery; never place text or logos inside generated art.
- **14.6 No text in pixels.** Generated images must contain no letters,
  numerals, or marks that read as branding; this is enforced by prompt and
  checked at review. A numeral baked into pixels is a doctrine leak.
- **14.7 Spend policy.** Batch generation is budgeted and explicit:
  contact-sheet exploration at low quality, keepers at medium, high reserved
  for singular hero moments. No full-population passes until the style and
  integration are signed off (see `docs/BACKLOG.md`).

## 15. The Game Loop Affordance (new; amends §6, §10)

- **15.1 Continue.** The turn loop gets exactly one persistent, context-aware
  primary action, housed at the right end of the masthead: "Advance —
  Week N" during a season, "End season" when all fixtures are played.
  It is the only moss-filled element in the masthead and is visible on every
  screen. Screen-local primary actions (Bid, Save tactics) remain, but they
  never compete with Continue in placement or weight.
- **15.2 Blocked states.** When advancing is blocked (unfieldable squad),
  Continue renders disabled with a one-line reason and links to the fixing
  surface. It never silently disappears.

## 16. State Vocabulary (new)

- **16.1 Pre-play.** Before a season's first whistle, tables show em-dashes,
  not zeros ("0" claims a fact; "—" says *not yet*), ordered by last
  season's finish, beneath a "Season opens this week" band containing
  Continue.
- **16.2 Empty.** Empty lists state what will fill them and the action that
  causes it ("No reports yet — assign a scout."). Never a bare "No data".
- **16.3 Loading.** Text placeholders in `parchment-400`; no spinners on
  parchment surfaces, no skeleton shimmer (banned motion).

## 17. Corrections to v1.0 implementation drift

- Availability tier chips (Fresh / Ready / Heavy / Spent / Injured /
  Suspended) are tinted with the §2.4 form stops their words already carry
  (color-with-words, per §11) instead of rendering as outline-gray text.
- Clarification: the small five-square strips on squad rows are the §10.2
  inline **form strips** (recent-match tier evidence), not an attribute
  gauge; they are sanctioned and should spread to other list surfaces, not
  disappear. Any strip must always pair with accessible tier words.
- Implementation debts v1.0 already mandates, tracked in `docs/BACKLOG.md`:
  live right-side Inspectors on list pages (§10.2), inline form strips on
  the remaining list surfaces (§10.2), compact density mode (§5.6), 2px
  club-primary selected states (§5.2).

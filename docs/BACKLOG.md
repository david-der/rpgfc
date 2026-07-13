# Backlog

Deferred work, in rough priority order. Items here are deliberate
decisions to wait, not forgotten ideas — each notes what it's blocked on.

## Art (blocked on: aesthetic direction sign-off — no paid generation until then)

- **Full-league portrait pass** — ~180 remaining players ≈ $9.50 at
  medium quality via `pnpm gen-art`. Do only after the charcoal style and
  its in-UI integration are confirmed on the managed squad, and after the
  world seed is one we intend to keep.
- **Art-on-arrival** — youth intake and signings get a portrait generated
  when they enter the world (silhouettes cover them until then).
- **Spot art for narrative moments** — youth-intake letter, signing
  confirmation, injury note (1280×800 editorial spots, one per context).
- **Match-report and fixture crests** — ClubCrest into match headers and
  fixture rows (needs club colors in two more responses).
- **Position-specific silhouettes in lists** — PlayerAvatar callers pass
  `positionLabel` (plumbing exists).

## Aesthetic rebalance (proposed 2026-07-13; see design notes)

- Persistent context-aware "Continue" action in the shell — the game
  loop's primary button, always visible.
- Pre-season league table: dashes + season-opens band instead of a grid
  of zeros.
- Availability chips tinted with their paired form-gradient stop
  (words remain — color never load-bearing alone).
- Replace squad workload pips (reads as a banned gauge) with tier
  word + dot.
- Background-tier zoning + fewer boxed cards so boxes regain meaning.
- Club-color identity on club-owned screens (section accents, primary
  buttons, featured rows) vs neutral league surfaces.
- Distinct header signatures per page archetype (Dashboard hero /
  List identity band / Profile hero / Editor work-area).

## Engine

- Home advantage: apply the edge inside the logistic (additive edge is
  truncated at probability clamps; league shows 99/95 despite in-band
  cohort edge).
- Context-derived shot xG refinements; card→10-men already done, red
  rate review after next long run.
- Merit: revisit only if world gen widens club quality spreads (~4 pts
  today, by design).

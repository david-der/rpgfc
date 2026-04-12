# Season Simulator

Runs a full 18-match-week season against a fresh in-memory DB with
all 10 clubs controlled by distinct persona strategies. Writes an
analytical markdown report to `reports/`.

## Running

```sh
pnpm season-sim
```

Reports land in `tests/season-sim/reports/season-0-<timestamp>.md`.

## What's in the report

- **Persona assignments** — who's managing which club
- **Final league table**
- **Match week log** — every fixture, bid count, extension count, live top 3
- **Transfer attempts** — every persona-initiated bid with final state
- **Contract extension attempts** — accepts, rejects, reasons
- **Club transfer summary** — signed / rejected / expired / pending by club
- **Top scorers** + **xG leaders** — league-wide
- **End-of-season finances** — cash, wages, revenue, expenses per club
- **Auto-generated observations** — signal/noise indicators:
  rejection rates, finance imbalances, point spread

## Personas

Ten archetypes in `packages/server/src/sim-harness/personas.ts`:
Marquee · Analyst · Architect · Traditionalist · Opportunist ·
Calculator · Hoarder · Saboteur · Rotator · Minimalist.

Each implements `decide(ctx) → Action[]` and the harness applies the
actions via the same application-layer functions the HTTP routes call.

## Use cases

- **Balance tuning** — see if signed/rejected ratios feel right
- **Finance health** — do any clubs go negative? Revenue vs wages?
- **Persona effectiveness** — does The Architect produce a younger squad?
  Does The Marquee overspend?
- **Engine determinism** — same seed produces the same season
- **Feature regression** — run before/after changes to see the impact

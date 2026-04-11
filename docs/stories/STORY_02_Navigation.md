# RPG FC — Story 02

## Navigation Shell

A clickable navigation shell that ties the landing page, the player list, and
the player profile together. Matches the Style Guide's tab-bar pattern, stays
inside the zero-radius / no-shadow visual language, and leaves enough structure
for later stories to bolt on new destinations without touching the shell.

---

## Story Metadata

| Field | Value |
|---|---|
| Story ID | RPGFC-02 |
| Phase | Phase 1 — First Vertical Slice |
| Estimate | 2–4 days solo, or ~2–3 focused Claude Code sessions |
| Depends on | RPGFC-00, RPGFC-01 |
| Blocks | RPGFC-03 (Scouting) and all later feature stories that want a nav entry |
| References | Style Guide §5.4, §6.4, §10; TDD v2 §8.1; Story 00 root layout |
| Status | Ready for implementation |

---

## 1. Summary

Story 01 shipped `/players` and `/players/$id` but they are reachable only by
typing the URL. Story 02 gives the game a persistent top-level navigation so
every page is one click away, and establishes the shell every future story
will drop new destinations into.

The nav is a thin horizontal bar — Style Guide §6.4 is the canonical pattern:
border-bottom indicator, 2px moss-500 on the active tab, 1px parchment-300 on
inactive. No drop shadow, no fill, no floating chrome. It should read like
the masthead of a match programme, not like a dashboard rail.

### 1.1 Why this story next

Story 01 set the unbreakable precedent that every feature page composes from
the Style Guide component vocabulary. Story 02 does the same for inter-page
navigation: one canonical `NavBar`, one canonical `AppShell` wrapper, and a
typed nav registry so adding a destination in Story 03+ is a single-line
change.

Doing this before Story 03 (Scouting) means every subsequent story lands with
the shell already present. Doing it later means retrofitting every existing
page.

### 1.2 User value

After one click from any screen, any other primary destination is reachable.
The active section is obvious at a glance. Deep-links still work (the URL is
authoritative — the shell reads the router, not the other way around).
Keyboard users can tab through destinations and activate them with Enter.

### 1.3 Not goals

- **No sidebar.** Style Guide §5.4 specifies a right-hand Inspector, not a
  left sidebar. The Inspector is a per-page affordance, not a nav element.
- **No breadcrumbs across pages.** Per-page `SectionHeader` breadcrumbs are
  the right tool for in-section navigation; cross-section breadcrumbs would
  overlap with the tab bar.
- **No mega-menu or dropdowns.** If a primary destination needs nesting,
  it's two primary destinations.
- **No search bar in the shell.** Search is a feature-specific affordance
  (e.g. the transfer-market search); it doesn't belong in global chrome.
- **No user/account menu.** Auth and user profiles land with Story 09.
- **No mobile hamburger.** v1 is desktop-web. Responsive wrap is tested at
  narrower widths but the shell is horizontal-first.

---

## 2. In Scope

### 2.1 Components

New components under `packages/web/src/components/ui/`:

- **`NavBar`** — horizontal tab-bar-style navigation, implemented per Style
  Guide §6.4. Props: `items: NavItem[]`, `activeKey: string`. Each item
  renders as a TanStack Router `<Link>` with the active state driven by
  TanStack Router's `useMatchRoute` hook.
- **`NavBarItem`** (internal) — one nav entry. Handles active/inactive
  styling, hover transition, focus ring.
- **`AppShell`** — thin layout wrapper that renders: a 2px `--club-stripe`
  top edge, the `NavBar`, and an `<Outlet />` for the route content. Used
  as the top-level layout in `__root.tsx`.

### 2.2 Nav registry

A single source of truth for destinations:

```ts
// packages/web/src/lib/navigation.ts
export interface NavItem {
  key: string;
  label: string;
  to: string;                    // TanStack Router link target
  icon?: LucideIcon;
  description?: string;          // for aria-label
}

export const PRIMARY_NAV: NavItem[] = [
  { key: "home",    label: "Home",    to: "/",        icon: Home },
  { key: "players", label: "Players", to: "/players", icon: Users },
];
```

Story 02 adds two entries — Home and Players. Story 03+ appends to this
array; no file outside `navigation.ts` knows the full list.

### 2.3 Root layout changes

`packages/web/src/routes/__root.tsx` is rewritten to render `<AppShell>`
around the `<Outlet />`. The landing page and the Story 01 pages all
inherit it.

The page-specific top margin / padding that the landing page currently
has is preserved — the shell adds chrome, not layout opinion.

### 2.4 Accessibility

- The `NavBar` is a `<nav aria-label="Primary">` region.
- Each item is a button-like link with a visible focus ring (2px
  moss-600, `outline-offset-2`).
- Tab order follows visual order.
- The active item carries `aria-current="page"`.
- Screen readers announce the nav label once and each destination by
  name.
- Keyboard: Tab moves focus, Enter activates, Arrow keys do NOT rotate
  focus (native link semantics only — we do not emulate `tablist`).

### 2.5 Visual specification

- Height: 48px.
- Background: `bg-parchment-50` (flush with the page).
- Bottom border: 1px `parchment-300` under the whole bar.
- Active item: 2px `moss-500` border-bottom, `text-parchment-900`,
  `font-medium`.
- Inactive item: 1px `parchment-300` border-bottom (aligned with the
  bar's bottom border so inactives disappear into the rule), `text-
  parchment-600`, `font-normal`.
- Hover on inactive: `text-parchment-900`, 150ms transition on color
  only. **No background fill, no scale, no shadow.**
- Item spacing: `gap-8` between destinations, matching the Style Guide's
  generous-spacing default.
- Icon size: 20px, Lucide stroke-1.5 per §7.1.
- Item padding: `px-3 py-3`, enough to satisfy the 44×44 touch target
  requirement in Style Guide §11 (height = 48px + 3 px-3 horizontal).

### 2.6 Router integration

TanStack Router's `useMatchRoute` determines the active key. The
`NavBar` computes active state like:

```ts
function isActive(item: NavItem, pathname: string): boolean {
  if (item.to === "/") return pathname === "/";
  return pathname === item.to || pathname.startsWith(item.to + "/");
}
```

This makes `/players/1` highlight the "Players" tab. Home only
highlights on exact `/`.

### 2.7 Tests

- Component test: `NavBar` renders the expected number of items, the
  `aria-current="page"` tag is on the active item, the non-active items
  are `<Link>` elements to the correct targets.
- Component test: active-state resolution across representative paths
  (`/`, `/players`, `/players/1`, `/players/nope/42`).
- Playwright: clicking from `/` to the Players tab navigates to
  `/players` without a full page reload. Clicking back to Home returns.
- Playwright: keyboard-only — Tab into the shell, Enter on "Players",
  assert the URL is `/players`.
- Doctrine: every `NavBar` item is inside the `<nav>` region and
  **none of them contain `data-testid="player-facing"`**. Nav labels
  are UI chrome, not player data.

---

## 3. Out of Scope

- Secondary navigation within a page (in-section tabs) — that's already
  served by `TabBar` on the Profile archetype.
- Right-hand Inspector panel contents — per-page concern, not nav.
- A search bar, command palette, or global shortcut shelf.
- Mobile hamburger menu.
- Responsive breakpoint work below 768px (the shell stays horizontal
  down to ~640px via `flex-wrap`; below that is explicitly not
  supported in v1).
- Any nav item that requires data fetching (e.g., a "badges earned
  today" counter). Chrome stays stateless.
- Multi-club or multi-run switcher. Story 08.

---

## 4. Acceptance Criteria

### 4.1 Component

**AC-01** — `NavBar` renders every item from the registry
- **Given** a `PRIMARY_NAV` with two items.
- **When** `<NavBar items={PRIMARY_NAV} />` is rendered.
- **Then** the DOM contains exactly two `<a>` elements inside a `<nav>`
  region with `aria-label="Primary"`.
- **Verified by** `packages/web/src/test/components/NavBar.test.tsx`.

**AC-02** — Active-state resolution
- **Given** a `NavBar` rendered at each of the paths `/`, `/players`,
  `/players/1`, `/elsewhere`.
- **When** the active states are computed.
- **Then**:
  - `/` → "Home" has `aria-current="page"`.
  - `/players` → "Players" has `aria-current="page"`.
  - `/players/1` → "Players" has `aria-current="page"`.
  - `/elsewhere` → neither has `aria-current`.
- **Verified by** `packages/web/src/test/components/NavBar.test.tsx`.

**AC-03** — Zero-radius, no-shadow visual adherence
- **Given** a rendered `NavBar` in jsdom.
- **When** computed styles are inspected.
- **Then** no element under the nav has a non-zero `border-radius` or
  any `box-shadow`.
- **Verified by** `packages/web/src/test/components/NavBar.test.tsx`.

### 4.2 Layout

**AC-04** — `AppShell` is the root of every page
- **Given** the default route tree.
- **When** Playwright navigates to `/`, `/players`, `/players/1`.
- **Then** on every page, the `NavBar` is visible at the top, above the
  page content, and the 2px club-stripe is visible above the nav.
- **Verified by** `tests/doctrine/nav-shell.spec.ts`.

**AC-05** — Landing page still passes AC-14/15 from Story 00
- **Given** Story 00's landing-palette and landing-health specs.
- **When** the doctrine suite runs with Story 02 merged.
- **Then** both specs still pass — the landing page's palette assertions
  are unchanged and the health dialect still shows inside its card.
- **Verified by** the existing `tests/doctrine/landing-*.spec.ts`.

### 4.3 Navigation behavior

**AC-06** — Click from Home to Players navigates without reload
- **Given** the dev server at `/`.
- **When** Playwright clicks the "Players" nav item.
- **Then** the URL becomes `/players`, the `NavBar` updates its active
  state, and no full page reload occurs (Playwright asserts with a
  page-load counter).
- **Verified by** `tests/doctrine/nav-shell.spec.ts`.

**AC-07** — Back-and-forth navigation preserves state
- **Given** `/`.
- **When** the user clicks Players → Home → Players.
- **Then** each transition completes within 200ms and the final URL is
  `/players`. No hydration warning appears in the console.
- **Verified by** `tests/doctrine/nav-shell.spec.ts`.

**AC-08** — Deep-linking works
- **Given** the dev server cold.
- **When** Playwright loads `/players/1` directly.
- **Then** the Players tab is active immediately, without a flash of an
  unhighlighted state.
- **Verified by** `tests/doctrine/nav-shell.spec.ts`.

### 4.4 Accessibility

**AC-09** — Keyboard-only navigation works
- **Given** `/`.
- **When** Playwright presses Tab until focus lands on the Players nav
  item, then Enter.
- **Then** the URL becomes `/players`.
- **Verified by** `tests/doctrine/nav-shell.spec.ts`.

**AC-10** — Focus ring is visible
- **Given** focus on a `NavBar` item.
- **When** the computed outline is inspected.
- **Then** `outline-width: 2px`, `outline-color` matches `moss-600`,
  `outline-offset: 2px`.
- **Verified by** `packages/web/src/test/components/NavBar.test.tsx`.

**AC-11** — Screen reader semantics
- **Given** the `NavBar`.
- **When** inspected via the accessibility tree.
- **Then** it is a `navigation` landmark with name "Primary", each item
  is a `link` with its label as its accessible name, and exactly one
  item is `aria-current="page"` at a time.
- **Verified by** `packages/web/src/test/components/NavBar.test.tsx`
  using Testing Library's `getByRole`.

### 4.5 Doctrine

**AC-12** — Nav labels are not player-facing
- **Given** the `NavBar` rendered.
- **When** the DOM is scraped for `data-testid="player-facing"` under
  the nav region.
- **Then** zero matches. Nav labels are UI chrome.
- **Verified by** `tests/doctrine/nav-shell.spec.ts`.

**AC-13** — Doctrine suite still clean end-to-end
- **Given** the full Story 01 + Story 02 build.
- **When** `pnpm doctrine` runs.
- **Then** all existing specs (landing-palette, landing-health,
  no-numbers, players-list, player-profile) plus the new nav-shell
  spec exit 0.
- **Verified by** CI.

---

## 5. Suggested Task Breakdown

1. **Nav registry.** Create `packages/web/src/lib/navigation.ts` with
   `NavItem` type and `PRIMARY_NAV` — two entries.
2. **`NavBar` component.** Ship in `components/ui/NavBar.tsx`. Write
   AC-01 through AC-03 + AC-10 + AC-11 tests first. Observe red.
   Implement against Style Guide §6.4.
3. **`AppShell` layout wrapper.** Ship in `components/ui/AppShell.tsx`.
   Accepts `children` (the routed content). Renders the club-stripe,
   the `NavBar`, and the children.
4. **Rewire `__root.tsx`.** Replace the current `<div>` wrapper with
   `<AppShell>`. Verify Story 01's pages still render unchanged.
5. **Playwright spec.** `tests/doctrine/nav-shell.spec.ts` covering
   AC-04, AC-06, AC-07, AC-08, AC-09, AC-12.
6. **Regression sanity pass.** Run the full doctrine suite. AC-13.
7. **Docs.** Update `packages/web/CLAUDE.md` with a section on the nav
   registry and the decision to keep nav chrome out of
   `player-facing`.

---

## 6. Definition of Done

- All AC-01 through AC-13 pass in CI under both dialects.
- A deliberate `<span data-testid="player-facing">Pace 17</span>`
  added to a `NavBar` item fails the doctrine suite. Documented and
  reverted.
- The nav appears on `/`, `/players`, and `/players/1` with the correct
  active-state resolution.
- Keyboard-only navigation works end-to-end.
- No component's visual chrome is re-implemented freelance — `NavBar`
  and `AppShell` are the only nav primitives.
- `packages/web/CLAUDE.md` documents the nav-registry pattern for Story
  03+ to follow.

---

## 7. Review Checklist

### 7.1 Structural

- One `NavBar` component; one `AppShell` component; one nav registry.
- No per-page navigation wiring; every nav entry flows through
  `PRIMARY_NAV`.
- `__root.tsx` is the only route file that touches `AppShell`.
- No new `Link` usages outside the nav layer; in-page links stay on
  TanStack Router `<Link>` where they already existed.

### 7.2 Style Guide

- Zero `border-radius` anywhere under the nav.
- Zero `box-shadow`.
- Active tab: 2px `moss-500` border-bottom.
- Inactive tab: 1px `parchment-300` border-bottom.
- Item padding meets the 44×44 touch target minimum.
- Transition: 150ms on color only.
- Icons are Lucide stroke icons, 20px.
- Fonts: Inter at `text-sm` for labels.

### 7.3 Accessibility

- `<nav aria-label="Primary">` wraps the whole bar.
- Active item has `aria-current="page"`.
- Focus ring visible and compliant with WCAG AA.
- Full keyboard operability (AC-09 passes).

### 7.4 Doctrine

- AC-12 passes — nav labels are not `player-facing`.
- The full doctrine suite is green.
- AC-13 deliberate-violation walkthrough documented.

---

## 8. Known Risks & Pitfalls

### 8.1 Scope creep toward a sidebar

**Risk:** "Just one sidebar for secondary nav" feels small but
conflicts with Style Guide §5.4 (which reserves the right side for an
Inspector, not navigation). Once a sidebar lands, every page has to
reason about two navigation planes.

**Mitigation:** If a feature in Story 03+ needs sub-navigation, use
the `TabBar` component within the page. Never a sidebar.

### 8.2 Active-state flash on deep-link

**Risk:** A deep link like `/players/1` loads the bundle, and for one
frame the Players tab renders inactive before the router settles.

**Mitigation:** Compute active state synchronously from the router's
initial location (not from an effect). TanStack Router's
`useMatchRoute` is synchronous on the initial render.

### 8.3 A new nav item forgets accessibility

**Risk:** Story 03+ adds a nav entry that breaks `aria-current`
handling or focus ordering because the author bypasses the registry.

**Mitigation:** Document the nav-registry pattern in
`packages/web/CLAUDE.md`. Add a unit test that asserts every item in
`PRIMARY_NAV` passes through `NavBar` (not arbitrary JSX).

### 8.4 Club-stripe conflict

**Risk:** The Profile page's `--club-stripe` is also at the very top of
the page. Adding a shell-level stripe above the nav means two stripes
when you're on a Profile.

**Mitigation:** Ship only the shell stripe for Story 02. Revisit the
per-page stripe in Story 03 when real club colors land. Update
Story 01's Profile archetype to use a subtler accent (e.g. a 1px
`--club-primary` rule below the hero header) instead of a 2px top
stripe.

### 8.5 Hydration warnings from active-state mismatch

**Risk:** SSR is off for RPG FC (TDD v2 §1.3), so hydration warnings
wouldn't apply — but dev-mode StrictMode double-rendering can log
pseudo-warnings if the active state flickers.

**Mitigation:** Keep the active-state computation pure (a function of
`pathname`, no refs, no effects). The test suite asserts zero console
warnings during navigation (Playwright `console` listener).

---

## Appendix A — Example NavBar usage

```tsx
// packages/web/src/components/ui/AppShell.tsx
import type { ReactNode } from "react";
import { NavBar } from "./NavBar";
import { PRIMARY_NAV } from "../../lib/navigation";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-parchment-50 text-parchment-900">
      <div className="h-[2px] bg-club-stripe" aria-hidden />
      <NavBar items={PRIMARY_NAV} />
      <main>{children}</main>
    </div>
  );
}
```

```tsx
// packages/web/src/routes/__root.tsx
import { Outlet, createRootRoute } from "@tanstack/react-router";
import { AppShell } from "../components/ui/AppShell";

export const Route = createRootRoute({
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});
```

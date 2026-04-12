// Primary navigation registry — Story 02.
//
// Single source of truth for the app's top-level destinations. Every page
// visible in the NavBar flows through this array. When Story 03+ adds a
// new destination (Scouting, Transfers, Squad, Tactics, ...), append to
// PRIMARY_NAV here. No page should hand-roll its own nav JSX — compose
// NavBar + PRIMARY_NAV instead.
//
// NavItem.to is typed as a TanStack Router path string. The `as const`
// assertion on PRIMARY_NAV keeps the array's element tuples immutable so
// the router's link-type inference can narrow on `item.to` if needed.

import type { LucideIcon } from "lucide-react";
import {
  Building2,
  CalendarDays,
  ClipboardList,
  Handshake,
  Home,
  Search,
  UsersRound,
} from "lucide-react";

export interface NavItem {
  /** Stable identity used for React keys and active-state comparison. */
  key: string;
  /** Human-facing label rendered inside the NavBar link. */
  label: string;
  /** TanStack Router link target. */
  to: string;
  /** Canonical Lucide glyph paired with the label. Story 02 renders it
   *  only at larger widths, but the mapping lives here so future stories
   *  can add a compact variant without touching page code. */
  icon: LucideIcon;
  /** Aria description for assistive tech beyond the visible label. */
  description?: string;
}

export const PRIMARY_NAV: readonly NavItem[] = [
  {
    key: "home",
    label: "Home",
    to: "/",
    icon: Home,
    description: "Return to the landing page",
  },
  {
    key: "scouts",
    label: "Scouting",
    to: "/scouts",
    icon: Search,
    description: "Search and filter the player database",
  },
  {
    key: "transfers",
    label: "Transfers",
    to: "/transfers",
    icon: Handshake,
    description: "Open the transfer market",
  },
  {
    key: "tactics",
    label: "Tactics",
    to: "/tactics",
    icon: ClipboardList,
    description: "Edit the club's formation, style, and assignments",
  },
  {
    key: "squad",
    label: "Squad",
    to: "/squad",
    icon: UsersRound,
    description: "Bucket players into squad roles and read harmony",
  },
  {
    key: "league",
    label: "League",
    to: "/league",
    icon: CalendarDays,
    description: "League table, fixtures, and rival clubs",
  },
  {
    key: "club",
    label: "Club",
    to: "/club",
    icon: Building2,
    description: "Club finances and identity",
  },
] as const;

// Active-state resolution is pure and synchronous so deep links highlight
// the correct tab on first paint without a flash of unhighlighted nav.
//
// Home only matches an exact `/`. Every other nav item matches itself and
// any path starting with `${to}/` — that is how `/players/1` highlights
// the Players tab.
export function isNavItemActive(item: NavItem, pathname: string): boolean {
  if (item.to === "/") return pathname === "/";
  if (pathname === item.to) return true;
  return pathname.startsWith(`${item.to}/`);
}

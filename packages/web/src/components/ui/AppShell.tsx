// AppShell — the root layout wrapper.
//
// Lands in Story 02 as the single place every routed page hangs off. It
// renders a 2px club-stripe at the very top (driven by the --club-stripe
// CSS variable), then the primary NavBar, then a `<main>` region that
// hosts the router outlet.
//
// Every route inherits this layout via `__root.tsx`. Pages never render
// their own nav chrome — the registry in `lib/navigation.ts` owns the
// destination list, and any feature story that wants a new top-level
// entry appends there.
//
// The `<main>` wrapper has no max-width of its own so each page can
// still declare its own column width (the landing page uses
// `max-w-prose`, the Profile page uses `max-w-5xl`, etc.).

import type { ReactNode } from "react";

import { PRIMARY_NAV } from "../../lib/navigation";
import { ContinueButton } from "./ContinueButton";
import { NavBar } from "./NavBar";

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-parchment-50 text-parchment-900">
      {/* Style Guide §3.3 + v1.1 §13.1: the club stripe rides above the
          ink masthead at full saturation — the only chrome at full club
          color. Driven by the --club-stripe CSS variable. */}
      <div className="h-1 bg-club-stripe" aria-hidden />
      <NavBar items={PRIMARY_NAV}>
        <ContinueButton />
      </NavBar>
      <main>{children}</main>
    </div>
  );
}

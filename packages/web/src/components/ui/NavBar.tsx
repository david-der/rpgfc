// NavBar — Style Guide §6.4.
//
// Horizontal top-level navigation. Uses the same border-bottom-indicator
// pattern as the Profile TabBar: 2px moss-500 under the active item, 1px
// parchment-300 under inactive items. The 2px is the only 2px border in
// the UI, which makes the active destination instantly recognizable.
//
// Active state is resolved synchronously from the router's current
// location via `useRouterState({ select: ... })`. That selector returns
// the pathname on every navigation so the active class flips before the
// browser repaints — deep links land already-highlighted (AC-08).
//
// Accessibility (Story 02 AC-11):
//   - The bar is a `nav` landmark with aria-label="Primary".
//   - Each item is a TanStack Router <Link> → underlying `<a>`. Linear
//     Tab key traversal is the right interaction (no tablist arrow-key
//     rotation — these are real links, not a tablist).
//   - The active item carries aria-current="page".
//   - Focus-visible outline in moss-600 per Style Guide §11.
//
// Doctrine (AC-12):
//   - Nav labels are UI chrome, NEVER `data-testid="player-facing"`. The
//     doctrine suite asserts this from the outside; the component just
//     needs to never add that attribute inside its subtree.

import { Link, useRouterState } from "@tanstack/react-router";

import type { ReactNode } from "react";

import type { NavItem } from "../../lib/navigation";
import { isNavItemActive } from "../../lib/navigation";

interface NavBarProps {
  items: readonly NavItem[];
  /** Trailing masthead content (the Continue action). */
  children?: ReactNode;
}

// Force Inter on every tab label the same way TabBar does, via a Tailwind
// utility AND an inline font-family. jsdom doesn't resolve the utility to
// a real font at test time, and even in the browser we want immunity
// from ancestor serif stacks.
const LABEL_STYLE: React.CSSProperties = {
  fontFamily: "Inter, system-ui, -apple-system, sans-serif",
};

export function NavBar({ items, children }: NavBarProps) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  // Style Guide v1.1 §13.1 — the masthead is printed in ink. The dark
  // bar is the app's single largest dark surface; it is what makes the
  // cream pages below read as paper rather than beige.
  return (
    <nav aria-label="Primary" className="border-b border-parchment-900 bg-parchment-900">
      <div className="mx-auto flex max-w-5xl items-center gap-6 px-6">
        {items.map((item) => {
          const active = isNavItemActive(item, pathname);
          const Icon = item.icon;

          const base =
            "inline-flex h-12 items-center gap-2 px-3 font-sans text-sm outline-offset-2 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-moss-400";
          const activeClass = active
            ? "-mb-px border-b-2 border-moss-400 font-medium text-moss-300"
            : "-mb-px border-b border-transparent text-parchment-400 hover:text-parchment-100";

          // Accessible-name rule: don't set aria-label here — the visible
          // text inside the link (`item.label`) becomes the link's
          // accessible name, which is what screen readers want. The
          // `description` prop surfaces as a native tooltip via `title`
          // and does not replace the accessible name.
          return (
            <Link
              key={item.key}
              to={item.to}
              aria-current={active ? "page" : undefined}
              title={item.description}
              className={`${base} ${activeClass}`}
              style={LABEL_STYLE}
            >
              <Icon size={18} aria-hidden />
              <span>{item.label}</span>
            </Link>
          );
        })}
        {children}
      </div>
    </nav>
  );
}

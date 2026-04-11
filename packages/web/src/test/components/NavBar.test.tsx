// Story 02 component tests. Red-first: every assertion below is written
// before NavBar exists. Running this file now surfaces a module-not-found
// error until lib/navigation.ts and components/ui/NavBar.tsx land.
//
// AC coverage from docs/stories/STORY_02_Navigation.md:
//   AC-01 — render every item from the registry
//   AC-02 — active-state resolution across `/`, `/players`, `/players/1`, `/elsewhere`
//   AC-03 — zero radius + no shadow
//   AC-10 — visible focus ring classes
//   AC-11 — nav / link / aria-current screen-reader semantics
//
// NavBar depends on TanStack Router for active-state. We wrap it in a
// memory-router so the component mounts standalone (no real DOM router).

import { render, screen, within } from "@testing-library/react";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import { NavBar } from "../../components/ui/NavBar";
import { PRIMARY_NAV } from "../../lib/navigation";

// A tiny in-memory router with the routes the nav knows about. Each
// route renders the NavBar so the active-state logic is exercised.
function renderNavAt(path: string) {
  const rootRoute = createRootRoute({
    component: () => (
      <>
        <NavBar items={PRIMARY_NAV} />
        <Outlet />
      </>
    ),
  });
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: () => <p>home</p>,
  });
  const playersRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/players",
    component: () => <p>players</p>,
  });
  const playerProfileRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/players/$id",
    component: () => <p>profile</p>,
  });
  const elsewhereRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/elsewhere",
    component: () => <p>elsewhere</p>,
  });

  const routeTree = rootRoute.addChildren([
    indexRoute,
    playersRoute,
    playerProfileRoute,
    elsewhereRoute,
  ]);

  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
  });

  return render(<RouterProvider router={router} />);
}

describe("NavBar — Story 02", () => {
  it("AC-01: renders exactly the items from PRIMARY_NAV inside a Primary nav landmark", async () => {
    renderNavAt("/");
    const nav = await screen.findByRole("navigation", { name: "Primary" });
    const links = within(nav).getAllByRole("link");
    expect(links).toHaveLength(PRIMARY_NAV.length);
    for (const item of PRIMARY_NAV) {
      expect(within(nav).getByRole("link", { name: item.label })).toBeInTheDocument();
    }
  });

  it("AC-02: active state resolves on `/` → Home", async () => {
    renderNavAt("/");
    const nav = await screen.findByRole("navigation", { name: "Primary" });
    const active = within(nav)
      .getAllByRole("link")
      .find((el) => el.getAttribute("aria-current") === "page");
    expect(active, "no active link on /").toBeDefined();
    expect(active?.textContent).toBe("Home");
  });

  it("AC-02: active state resolves on `/players` → Players", async () => {
    renderNavAt("/players");
    const nav = await screen.findByRole("navigation", { name: "Primary" });
    const active = within(nav)
      .getAllByRole("link")
      .find((el) => el.getAttribute("aria-current") === "page");
    expect(active?.textContent).toBe("Players");
  });

  it("AC-02: deep-link `/players/1` still highlights Players", async () => {
    renderNavAt("/players/1");
    const nav = await screen.findByRole("navigation", { name: "Primary" });
    const active = within(nav)
      .getAllByRole("link")
      .find((el) => el.getAttribute("aria-current") === "page");
    expect(active?.textContent).toBe("Players");
  });

  it("AC-02: `/elsewhere` leaves every item inactive", async () => {
    renderNavAt("/elsewhere");
    const nav = await screen.findByRole("navigation", { name: "Primary" });
    const current = within(nav)
      .getAllByRole("link")
      .filter((el) => el.getAttribute("aria-current") === "page");
    expect(current.length).toBe(0);
  });

  it("AC-03: no nav element carries a non-zero border-radius or a shadow", async () => {
    renderNavAt("/");
    const nav = await screen.findByRole("navigation", { name: "Primary" });
    const allUnderNav = nav.querySelectorAll<Element>("*");
    for (const el of Array.from(allUnderNav)) {
      // SVG children expose `className` as SVGAnimatedString, not a plain
      // string. Coerce both cases so the regex check works uniformly.
      const raw = (el as HTMLElement).className as unknown;
      const cls = typeof raw === "string" ? raw : ((raw as { baseVal?: string })?.baseVal ?? "");
      expect(cls).not.toMatch(/\brounded-(sm|md|lg|xl|2xl|3xl|full)\b/);
      expect(cls).not.toMatch(/\bshadow(-sm|-md|-lg|-xl|-2xl)?\b/);
    }
  });

  it("AC-10: items carry a visible focus ring via focus-visible utilities", async () => {
    renderNavAt("/");
    const nav = await screen.findByRole("navigation", { name: "Primary" });
    for (const link of within(nav).getAllByRole("link")) {
      // Tailwind focus ring: focus-visible:outline + outline-offset-2 +
      // outline-moss-600 (matches Style Guide §11 accessibility).
      expect(link.className).toMatch(/focus-visible:outline/);
      expect(link.className).toMatch(/outline-moss-600/);
    }
  });

  it("AC-11: labels are in the Inter sans stack, never serif", async () => {
    renderNavAt("/");
    const nav = await screen.findByRole("navigation", { name: "Primary" });
    for (const link of within(nav).getAllByRole("link")) {
      expect(link.className).toMatch(/font-sans/);
      expect(link.className).not.toMatch(/font-serif/);
    }
  });

  it("AC-12: no element under the nav carries data-testid='player-facing'", async () => {
    renderNavAt("/");
    const nav = await screen.findByRole("navigation", { name: "Primary" });
    expect(nav.querySelectorAll('[data-testid="player-facing"]').length).toBe(0);
  });
});

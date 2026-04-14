import { createRootRoute, Outlet } from "@tanstack/react-router";

import { PlayerModalProvider } from "../components/PlayerModalProvider";
import { AppShell } from "../components/ui/AppShell";

// Root layout. Story 02 wraps every routed page in the AppShell so the
// club stripe, NavBar, and main content region are consistent across
// Home, Players, and the Profile view — no page owns its own nav chrome.
//
// PlayerModalProvider sits at the root so any row anywhere (squad,
// scouts, watchlist, bids, offers) can call `openPlayer(id)` and get a
// pop-out trading card without threading state down through the tree.

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  return (
    <PlayerModalProvider>
      <AppShell>
        <Outlet />
      </AppShell>
    </PlayerModalProvider>
  );
}

import { createRootRoute, Outlet } from "@tanstack/react-router";

import { AppShell } from "../components/ui/AppShell";

// Root layout. Story 02 wraps every routed page in the AppShell so the
// club stripe, NavBar, and main content region are consistent across
// Home, Players, and the Profile view — no page owns its own nav chrome.

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

import { Outlet, createRootRoute } from "@tanstack/react-router";

// Root layout. Story 00 keeps it minimal — just the outlet. Navigation chrome,
// club theming wrapper, and the persistent Inspector land in Story 01+.
export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  return (
    <div className="min-h-screen bg-parchment-50 text-parchment-900">
      <Outlet />
    </div>
  );
}

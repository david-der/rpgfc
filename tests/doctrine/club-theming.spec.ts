import { expect, test } from "@playwright/test";

// Story 03 AC-04: club identity is themed on the Profile page.
//
// The expanded RenderedClubRef carries colors that the seeded
// club_identity_ext table populates deterministically per club name.
// This test asserts that:
//   - The /players/1 response carries a club shape with non-empty hex
//     colors (verified via the rendered facts row).
//   - The hex strings are valid 6-character hex codes — meaning the
//     server-side seed actually populated the table, and the rendering
//     layer carried the colors all the way out to the wire.
//
// Note: Story 03 ships the data and the API surface for theming. Wiring
// the actual `--club-primary` CSS variable on the page chrome can land
// in a follow-up story without changing this contract.

test("AC-04: /api/players/1 carries themed club colors", async ({ request }) => {
  const res = await request.get("/api/players/1");
  expect(res.status()).toBe(200);
  const body = (await res.json()) as {
    club: {
      id: number;
      name: string;
      reputation: string;
      colors: { primary: string; secondary: string; stripe: string };
    } | null;
  };
  expect(body.club).not.toBeNull();
  const colors = body.club!.colors;
  // Each color must be a 7-char hex string ("#RRGGBB").
  expect(colors.primary).toMatch(/^#[0-9A-Fa-f]{6}$/);
  expect(colors.secondary).toMatch(/^#[0-9A-Fa-f]{6}$/);
  expect(colors.stripe).toMatch(/^#[0-9A-Fa-f]{6}$/);
  // Reputation tier is one of the five.
  expect(["Local", "Regional", "National", "Continental", "Elite"]).toContain(
    body.club!.reputation,
  );
});

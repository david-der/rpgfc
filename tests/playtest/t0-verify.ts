// Session 6: verify each T0 fix landed.
//   T0-1 Home dashboard  — snap /
//   T0-2 Fixtures filter — snap /league → Fixtures tab, count MW1 rows
//   T0-3 Offers label    — snap /transfers → Offers, verify "Bid from <rival>"
//   T0-4 Error wrapping  — trigger a bad extension, snap friendly message
//   T0-5 Free-agent 400  — attempt to bid on a non-player-id and assert 400

import { chromium, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const BASE = process.env["PLAYTEST_BASE"] ?? "http://localhost:5173";
const OUT = "/tmp/rpgfc-playtest";
mkdirSync(OUT, { recursive: true });

async function snap(page: Page, label: string, full = false) {
  await page.screenshot({ path: resolve(OUT, `t0-${label}.png`), fullPage: full });
  console.log(`📸 t0-${label}`);
}

async function main() {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log(`  [pageerror] ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") console.log(`  [console.error] ${m.text()}`);
  });

  // T0-1 Home.
  console.log("\n▶ T0-1 Home dashboard");
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.waitForTimeout(700);
  await snap(page, "1-home");
  const heroTxt = await page.locator("h1").first().textContent();
  console.log(`  hero: "${heroTxt?.trim()}"`);

  // T0-2 Fixtures filter. After /league, click Fixtures tab, count MW1.
  console.log("\n▶ T0-2 Fixtures (single season)");
  await page.goto(`${BASE}/league`, { waitUntil: "networkidle" });
  await page
    .getByText(/^\s*Fixtures\s*$/i)
    .first()
    .click();
  await page.waitForTimeout(500);
  await snap(page, "2-fixtures");
  // Count MW1 fixture cards.
  const mw1Cards = await page.locator("text=/^Match Week 1$/i").count();
  const allFixtureLinks = await page.locator('a[href^="/matches/"]').count();
  console.log(`  MW1 headers visible: ${mw1Cards}`);
  console.log(`  match links total: ${allFixtureLinks} (10 clubs × 18 MW → expect 90)`);

  // T0-3 Offers tab.
  console.log("\n▶ T0-3 Offers labels");
  await page.goto(`${BASE}/transfers`, { waitUntil: "networkidle" });
  await page
    .getByText(/^\s*Offers\s*$/i)
    .first()
    .click();
  await page.waitForTimeout(500);
  await snap(page, "3-offers");
  const offersTxt = (await page.locator("main, body").first().textContent()) ?? "";
  const rivalBid =
    /Bid from\s+(AC Barcelona|Real Oviedo|Sporting Recife|Racing Porto Alegre|Sporting Madrid|Internacional Curitiba|AC Curitiba|Atlético Arnhem|Unión Salvador)/.test(
      offersTxt,
    );
  const selfBid = /Bid from Club Madrid/.test(offersTxt);
  console.log(`  rival-attributed bids: ${rivalBid ? "✓" : "✗"}`);
  console.log(`  self-attributed bids (bug regression): ${selfBid ? "✗ REGRESSED" : "✓"}`);

  // T0-4 Error wrapping — submit an extension that will probably be rejected.
  console.log("\n▶ T0-4 Friendly error on extend");
  await page.goto(`${BASE}/players/1`, { waitUntil: "networkidle" });
  await page
    .getByText(/^\s*Contract\s*$/i)
    .first()
    .click();
  await page.waitForTimeout(400);
  // Pick Minimal wage + 1 season to provoke a PLAYER_WAGE_FLOOR rejection.
  const selects = await page.locator("select").all();
  if (selects.length >= 4) {
    // Weekly Wage → Minimal
    await selects[0]!.selectOption({ label: "Minimal" });
    // Seasons → 1 season
    try {
      await selects[2]!.selectOption({ label: "1 seasons" });
    } catch {
      // some dropdowns label it "1 season" — try that too
      try {
        await selects[2]!.selectOption({ label: "1 season" });
      } catch {
        /* ignore */
      }
    }
  }
  const offerBtn = page.getByRole("button", { name: /offer extension/i });
  if (await offerBtn.isVisible().catch(() => false)) {
    await offerBtn.click();
    await page.waitForTimeout(1000);
  }
  await snap(page, "4-extend-friendly");
  const allText = (await page.locator("main, body").first().textContent()) ?? "";
  const has409 = /\b409\b|extend-contract failed/.test(allText);
  const hasFriendly = /He expects|turned down|wage floor/i.test(allText);
  console.log(`  raw HTTP code (regression): ${has409 ? "✗ REGRESSED" : "✓"}`);
  console.log(`  friendly paraphrase: ${hasFriendly ? "✓" : "(not visible — may have accepted)"}`);

  // T0-5 Free-agent 400. Directly hit /api/transfers/<free_agent_id>/bid.
  console.log("\n▶ T0-5 Free-agent bid → 400");
  const resp = await page.evaluate(async () => {
    // Pick a free agent id — any player with club_id null. Use 200 as a
    // probably-free-agent after retirements; fall back to posting to a
    // very-high id that likely doesn't exist.
    const freeAgents = await fetch("/api/players?limit=100")
      .then((r) => r.json())
      .catch(() => null);
    if (!freeAgents?.items) return { status: 0, body: null };
    const fa = freeAgents.items.find((p: { clubId: number | null }) => p.clubId === null);
    if (!fa) return { status: -1, body: "no free agent found in top 100 listing" };
    const r = await fetch(`/api/transfers/${fa.id}/bid`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        feeTier: "Modest",
        wageTier: "Modest",
        signingBonusTier: "Minimal",
        rolePromise: "Important Player",
      }),
    });
    let body: unknown = null;
    try {
      body = await r.json();
    } catch {
      /* ignore */
    }
    return { status: r.status, body };
  });
  console.log(`  status: ${resp.status}`);
  console.log(`  body: ${JSON.stringify(resp.body)}`);

  await b.close();
  console.log(`\nScreenshots → ${OUT}/t0-*`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

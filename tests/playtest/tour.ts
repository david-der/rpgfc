// Playtest tour — drives every major route, takes screenshots, and
// snapshots visible text so the author can critique the experience
// without eyeballing 15 PNGs one by one.

import { chromium, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const BASE = process.env["PLAYTEST_BASE"] ?? "http://localhost:5173";
const OUT = process.env["PLAYTEST_OUT"] ?? "/tmp/rpgfc-playtest";
mkdirSync(OUT, { recursive: true });

interface Shot {
  label: string;
  url: string;
  heading: string;
  snippet: string;
  errors: string[];
}

async function shoot(page: Page, label: string, path: string): Promise<Shot> {
  const url = `${BASE}${path}`;
  const errors: string[] = [];
  page.removeAllListeners("pageerror");
  page.on("pageerror", (err) => errors.push(err.message));
  const resp = await page.goto(url, { waitUntil: "networkidle", timeout: 15000 });
  if (resp && !resp.ok()) errors.push(`HTTP ${resp.status()}`);
  await page.waitForTimeout(400);
  await page.screenshot({ path: resolve(OUT, `${label}.png`), fullPage: true });
  const heading = await page.locator("h1,h2").first().textContent().catch(() => "") ?? "";
  const body = await page.locator("main, body").first().textContent().catch(() => "") ?? "";
  return {
    label,
    url,
    heading: heading.trim().slice(0, 80),
    snippet: body.replace(/\s+/g, " ").trim().slice(0, 400),
    errors,
  };
}

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const shots: Shot[] = [];
  const stops: Array<[string, string]> = [
    ["01-home", "/"],
    ["02-league-table", "/league"],
    ["03-league-fixtures", "/league?tab=fixtures"],
    ["04-squad", "/squad"],
    ["05-club-finances", "/club"],
    ["06-club-ledger", "/club?tab=ledger"],
    ["07-scouts", "/scouts"],
    ["08-transfers-market", "/transfers"],
    ["09-transfers-my-bids", "/transfers?tab=my-bids"],
    ["10-transfers-offers", "/transfers?tab=offers"],
    ["11-transfers-watchlist", "/transfers?tab=watchlist"],
    ["12-tactics", "/tactics"],
    ["13-players-list", "/players"],
  ];

  for (const [label, path] of stops) {
    try {
      shots.push(await shoot(page, label, path));
      // eslint-disable-next-line no-console
      console.log(`✓ ${label}`);
    } catch (e) {
      shots.push({
        label,
        url: `${BASE}${path}`,
        heading: "",
        snippet: "",
        errors: [(e as Error).message],
      });
      // eslint-disable-next-line no-console
      console.log(`✗ ${label}: ${(e as Error).message}`);
    }
  }

  // Pick a player to profile — grab the first one from /players.
  try {
    await page.goto(`${BASE}/players`, { waitUntil: "networkidle", timeout: 15000 });
    const firstPlayerLink = page.locator('a[href^="/players/"]').first();
    const href = await firstPlayerLink.getAttribute("href");
    if (href) {
      shots.push(await shoot(page, "14-player-profile", href));
    }
  } catch { /* ignore */ }

  // Pick a club to drill into.
  try {
    shots.push(await shoot(page, "15-club-detail", "/league/clubs/7")); // Real Oviedo historically
  } catch { /* ignore */ }

  // Drill into a transfer composer for a listed player.
  try {
    await page.goto(`${BASE}/transfers`, { waitUntil: "networkidle", timeout: 15000 });
    const bidLink = page.locator('a[href^="/transfers/"]').first();
    const href = await bidLink.getAttribute("href");
    if (href && href !== "/transfers") {
      shots.push(await shoot(page, "16-transfer-composer", href));
    }
  } catch { /* ignore */ }

  writeFileSync(resolve(OUT, "tour.json"), JSON.stringify(shots, null, 2), "utf8");
  // eslint-disable-next-line no-console
  console.log(`\nScreenshots → ${OUT}`);
  // eslint-disable-next-line no-console
  console.log(`Report → ${resolve(OUT, "tour.json")}`);

  await browser.close();
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});

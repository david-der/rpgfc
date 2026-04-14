// Home dashboard — the manager's cockpit.
//
// Replaces the Story 00 "Walking Skeleton" landing. Pulls season state,
// the league table, fixtures, finances, squad, and transfer activity to
// give the manager a one-glance read on their club.

import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { Card } from "../components/ui/Card";
import { ResultPill } from "../components/ui/ResultPill";
import {
  fetchClubFinances,
  fetchFixtures,
  fetchHealth,
  fetchLeagueTable,
  fetchMyBids,
  fetchOffers,
  fetchSeasonState,
  fetchSquad,
} from "../lib/api";

export const Route = createFileRoute("/")({
  component: Home,
});

// Global roster rules (mirror server-side MIN_ROSTER_SIZE / MAX_ROSTER_SIZE).
const ROSTER_FLOOR = 18;
const ROSTER_CEILING = 30;

type Season = Awaited<ReturnType<typeof fetchSeasonState>>;
type Table = Awaited<ReturnType<typeof fetchLeagueTable>>;
type Fixtures = Awaited<ReturnType<typeof fetchFixtures>>;
type Finances = Awaited<ReturnType<typeof fetchClubFinances>>;
type Squad = Awaited<ReturnType<typeof fetchSquad>>;
type Bids = Awaited<ReturnType<typeof fetchMyBids>>;
type Offers = Awaited<ReturnType<typeof fetchOffers>>;

function formatCents(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  if (abs >= 1_000_000_000_00) return `${sign}$${(abs / 1_000_000_000_00).toFixed(1)}B`;
  if (abs >= 1_000_000_00) return `${sign}$${(abs / 1_000_000_00).toFixed(1)}M`;
  if (abs >= 1_000_00) return `${sign}$${(abs / 1_000_00).toFixed(0)}K`;
  return `${sign}$${(abs / 100).toFixed(0)}`;
}

function Home() {
  const seasonQ = useQuery({ queryKey: ["season-state"], queryFn: fetchSeasonState });
  const tableQ = useQuery({ queryKey: ["league-table"], queryFn: fetchLeagueTable });
  const fxQ = useQuery({ queryKey: ["fixtures"], queryFn: fetchFixtures });
  const financesQ = useQuery({ queryKey: ["club-finances"], queryFn: fetchClubFinances });
  const squadQ = useQuery({ queryKey: ["squad"], queryFn: fetchSquad });
  const bidsQ = useQuery({ queryKey: ["my-bids"], queryFn: fetchMyBids });
  const offersQ = useQuery({ queryKey: ["offers"], queryFn: fetchOffers });

  const finances = financesQ.data as Finances | undefined;
  const clubName = finances?.clubName ?? "Your club";
  const season = seasonQ.data as Season | undefined;
  const table = tableQ.data as Table | undefined;
  const fx = fxQ.data as Fixtures | undefined;
  const squad = squadQ.data as Squad | undefined;
  const bids = bidsQ.data as Bids | undefined;
  const offers = offersQ.data as Offers | undefined;

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <HomeHero clubName={clubName} season={season} />

      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        {/* Left column: match narrative */}
        <div className="space-y-4 lg:col-span-2">
          <LastResultCard fx={fx} finances={finances} />
          <NextFixtureCard fx={fx} finances={finances} />
          <LeaguePositionCard table={table} finances={finances} />
        </div>

        {/* Right column: club health */}
        <div className="space-y-4">
          <BudgetCard finances={finances} />
          <SquadHealthCard squad={squad} />
          <YouthIntakeCard squad={squad} />
          <TransferActivityCard bids={bids} offers={offers} />
        </div>
      </div>

      <SystemFooter />
    </div>
  );
}

// Quiet system strip at the foot of the dashboard. Also satisfies the
// Story 00 AC-15 doctrine probe (`data-testid="health-dialect"`).
function SystemFooter() {
  const health = useQuery({ queryKey: ["health"], queryFn: fetchHealth });
  return (
    <footer className="mt-12 flex items-center gap-3 border-t border-parchment-300 pt-3 text-xs text-parchment-500">
      <span className="uppercase tracking-wide">Backend</span>
      <span data-testid="health-dialect" className="font-mono text-parchment-700">
        {health.data?.dialect ?? "—"}
      </span>
      <span
        data-testid="health-commit-allowlist-number"
        className="font-mono text-parchment-500"
      >
        {health.data?.commit ?? "—"}
      </span>
    </footer>
  );
}

// ── hero ──────────────────────────────────────────────────────────────────

function HomeHero({ clubName, season }: { clubName: string; season: Season | undefined }) {
  const eyebrow = season
    ? `Season ${season.season + 1} · Match Week ${season.matchWeek}`
    : "Loading…";
  return (
    <header className="border-b border-parchment-300 pb-6">
      <div
        data-testid="home-eyebrow-allowlist-number"
        className="font-mono text-xs uppercase tracking-wide text-parchment-500"
      >
        {eyebrow}
      </div>
      <h1 className="mt-2 font-serif text-4xl font-medium text-parchment-900">{clubName}</h1>
      <p className="mt-3 font-serif text-lg leading-relaxed text-parchment-700">
        Welcome to the manager&rsquo;s office. Your season is below.
      </p>
    </header>
  );
}

// ── last result ──────────────────────────────────────────────────────────

function LastResultCard({
  fx,
  finances,
}: {
  fx: Fixtures | undefined;
  finances: Finances | undefined;
}) {
  if (!fx || !finances) {
    return <Card eyebrow="Last Result" title="—"><p className="text-parchment-500">Loading…</p></Card>;
  }
  const last = findLastResult(fx, finances.clubId);
  if (!last) {
    return (
      <Card eyebrow="Last Result" title="Season opens this week">
        <p className="text-parchment-600">Your first match is on the calendar.</p>
      </Card>
    );
  }
  const opponent = last.isHome ? last.away : last.home;
  return (
    <Card eyebrow={`Match Week ${last.matchday} · ${last.isHome ? "Home" : "Away"}`}>
      <div className="flex items-center justify-between">
        <Link
          to="/matches/$id"
          params={{ id: String(last.id) }}
          className="flex-1 font-serif text-2xl text-parchment-900 hover:underline"
        >
          <span data-testid="player-facing">
            {last.isHome ? "vs" : "at"} {opponent.name}
          </span>
        </Link>
        <div className="flex items-center gap-3">
          <span
            data-testid="home-last-score-allowlist-number"
            className="font-mono text-3xl tabular-nums text-parchment-900"
          >
            {last.home.goals} – {last.away.goals}
          </span>
          {last.userResult && <ResultPill result={last.userResult} />}
        </div>
      </div>
    </Card>
  );
}

// ── next fixture ─────────────────────────────────────────────────────────

function NextFixtureCard({
  fx,
  finances,
}: {
  fx: Fixtures | undefined;
  finances: Finances | undefined;
}) {
  if (!fx || !finances) return null;
  const next = findNextFixture(fx, finances.clubId);
  if (!next) {
    return (
      <Card eyebrow="Next Fixture" title="Season complete">
        <p className="text-parchment-600">
          Every fixture has been played. Head to{" "}
          <Link to="/league" className="underline">the League page</Link> to end the season.
        </p>
      </Card>
    );
  }
  const opponent = next.isHome ? next.away : next.home;
  return (
    <Card eyebrow={`Next · Match Week ${next.matchday} · ${next.isHome ? "Home" : "Away"}`}>
      <p className="font-serif text-2xl text-parchment-900">
        <span data-testid="player-facing">
          {next.isHome ? "vs" : "at"} {opponent.name}
        </span>
      </p>
      <div className="mt-2 text-xs uppercase tracking-wide text-parchment-500">
        <Link to="/tactics" className="underline hover:text-parchment-900">
          Prepare your tactics
        </Link>
      </div>
    </Card>
  );
}

// ── league position ──────────────────────────────────────────────────────

function LeaguePositionCard({
  table,
  finances,
}: {
  table: Table | undefined;
  finances: Finances | undefined;
}) {
  if (!table || !finances) return null;
  const myIndex = table.table.findIndex((r) => r.clubId === finances.clubId);
  if (myIndex < 0) {
    return <Card eyebrow="Table">Not placed in the league yet.</Card>;
  }
  const mine = table.table[myIndex]!;
  const leader = table.table[0]!;
  const myPos = myIndex + 1;
  return (
    <Card eyebrow="League">
      <div className="flex items-end justify-between">
        <div>
          <div
            data-testid="home-position-allowlist-number"
            className="font-mono text-5xl font-medium tabular-nums text-parchment-900"
          >
            {ordinal(myPos)}
          </div>
          <div className="mt-1 text-xs uppercase tracking-wide text-parchment-500">Position</div>
        </div>
        <div className="text-right">
          <div
            data-testid="home-points-allowlist-number"
            className="font-mono text-3xl tabular-nums text-parchment-900"
          >
            {mine.points} <span className="text-sm text-parchment-500">pts</span>
          </div>
          <div className="mt-1 text-xs uppercase tracking-wide text-parchment-500">
            {mine.won}-{mine.drawn}-{mine.lost}
          </div>
        </div>
      </div>
      {myIndex > 0 && (
        <p className="mt-3 text-sm italic text-parchment-600">
          <span data-testid="player-facing">{leader.clubName}</span> lead the table with{" "}
          <span data-testid="home-leader-points-allowlist-number" className="font-mono tabular-nums">
            {leader.points}
          </span>
          .
        </p>
      )}
      <Link
        to="/league"
        className="mt-3 inline-block text-xs uppercase tracking-wide text-parchment-500 underline hover:text-parchment-900"
      >
        Full table
      </Link>
    </Card>
  );
}

// ── budget ──────────────────────────────────────────────────────────────

function BudgetCard({ finances }: { finances: Finances | undefined }) {
  if (!finances) return null;
  const f = finances;
  const pct =
    f.wageBudgetCents > 0 ? Math.round((f.wageBillCents / f.wageBudgetCents) * 100) : 0;
  const healthy = f.wageBillVsBudget === "healthy";
  return (
    <Card eyebrow="Budget">
      <div>
        <div
          data-testid="home-cash-allowlist-number"
          className="font-mono text-3xl font-medium tabular-nums text-parchment-900"
        >
          {formatCents(f.cashCents)}
        </div>
        <div className="mt-1 text-xs uppercase tracking-wide text-parchment-500">Cash reserve</div>
      </div>
      <div className="mt-4 border-t border-parchment-300 pt-3">
        <div className="flex items-baseline justify-between">
          <span className="text-xs uppercase tracking-wide text-parchment-500">Weekly wages</span>
          <span
            data-testid="home-wages-allowlist-number"
            className="font-mono tabular-nums text-parchment-900"
          >
            {formatCents(f.wageBillCents)}
          </span>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <span
            className={`border px-2 py-0.5 font-sans text-xs uppercase tracking-wide ${
              healthy
                ? "border-moss-600 text-moss-700"
                : f.wageBillVsBudget === "tight"
                  ? "border-parchment-600 text-parchment-800"
                  : "border-clay-600 text-clay-700"
            }`}
          >
            {healthy ? "Healthy" : f.wageBillVsBudget === "tight" ? "Tight" : "Overspent"}
          </span>
          <span className="text-xs text-parchment-500">
            <span data-testid="home-wage-pct-allowlist-number" className="font-mono tabular-nums">
              {pct}%
            </span>{" "}
            of budget used
          </span>
        </div>
      </div>
      <Link
        to="/club"
        className="mt-3 inline-block text-xs uppercase tracking-wide text-parchment-500 underline hover:text-parchment-900"
      >
        Club finances
      </Link>
    </Card>
  );
}

// ── squad health ─────────────────────────────────────────────────────────

function SquadHealthCard({ squad }: { squad: Squad | undefined }) {
  if (!squad) return null;
  const count = squad.entries.length;
  const understaffed = count < ROSTER_FLOOR;
  const overstaffed = count > ROSTER_CEILING;
  return (
    <Card eyebrow="Squad">
      <div className="flex items-baseline justify-between">
        <div
          data-testid="home-roster-allowlist-number"
          className="font-mono text-3xl font-medium tabular-nums text-parchment-900"
        >
          {count}
        </div>
        <div className="text-xs uppercase tracking-wide text-parchment-500">Contracted</div>
      </div>
      {understaffed && (
        <div className="mt-3 border border-clay-600 bg-clay-50 p-2 text-sm text-clay-700">
          <strong className="font-semibold uppercase tracking-wide">Critical: </strong>
          below the{" "}
          <span data-testid="home-floor-allowlist-number" className="font-mono tabular-nums">
            {ROSTER_FLOOR}
          </span>{" "}
          player floor. Sign players urgently.
        </div>
      )}
      {overstaffed && (
        <div className="mt-3 border border-parchment-600 bg-parchment-50 p-2 text-sm text-parchment-800">
          Roster is over the normal ceiling of{" "}
          <span data-testid="home-ceiling-allowlist-number" className="font-mono tabular-nums">
            {ROSTER_CEILING}
          </span>
          . Consider listing or extending fringe players.
        </div>
      )}
      <div className="mt-3 flex items-center gap-2 text-xs text-parchment-500">
        <span>Harmony: </span>
        <span className="font-sans uppercase tracking-wide text-parchment-900">
          {squad.harmonyLabel}
        </span>
      </div>
      <Link
        to="/squad"
        className="mt-3 inline-block text-xs uppercase tracking-wide text-parchment-500 underline hover:text-parchment-900"
      >
        Squad overview
      </Link>
    </Card>
  );
}

// ── youth intake ─────────────────────────────────────────────────────────

function YouthIntakeCard({ squad }: { squad: Squad | undefined }) {
  if (!squad) return null;
  const arrivals = squad.entries.filter((e) => e.isNewArrival);
  if (arrivals.length === 0) return null;
  return (
    <Card eyebrow="Academy intake">
      <div
        data-testid="home-intake-allowlist-number"
        className="font-mono text-2xl tabular-nums text-parchment-900"
      >
        {arrivals.length}
      </div>
      <div className="text-xs uppercase tracking-wide text-parchment-500">
        Youth joined this summer
      </div>
      <ul className="mt-3 space-y-1 text-sm text-parchment-700">
        {arrivals.slice(0, 3).map((e) => (
          <li key={e.playerId}>
            <Link
              to="/players/$id"
              params={{ id: String(e.playerId) }}
              className="hover:underline"
            >
              <span data-testid="player-facing">{e.playerName}</span>
              <span className="ml-2 text-xs text-parchment-500">
                ({e.positionLabel})
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <Link
        to="/squad"
        className="mt-3 inline-block text-xs uppercase tracking-wide text-parchment-500 underline hover:text-parchment-900"
      >
        Full squad
      </Link>
    </Card>
  );
}

// ── transfer activity ────────────────────────────────────────────────────

function TransferActivityCard({
  bids,
  offers,
}: {
  bids: Bids | undefined;
  offers: Offers | undefined;
}) {
  if (!bids || !offers) return null;
  const activeBids =
    bids.bids?.filter((b) =>
      ["Submitted", "SellerReviewing", "SellerAccepted", "SellerCountered", "PlayerReviewing"].includes(
        b.state,
      ),
    ).length ?? 0;
  const activeOffers =
    offers.offers?.filter((o) =>
      ["Submitted", "SellerReviewing", "SellerAccepted", "SellerCountered", "PlayerReviewing"].includes(
        o.state,
      ),
    ).length ?? 0;
  return (
    <Card eyebrow="Transfers">
      <div className="grid grid-cols-2 gap-3">
        <Link to="/transfers" className="block hover:bg-parchment-50 p-2 -m-2">
          <div
            data-testid="home-active-bids-allowlist-number"
            className="font-mono text-2xl tabular-nums text-parchment-900"
          >
            {activeBids}
          </div>
          <div className="text-xs uppercase tracking-wide text-parchment-500">Pending bids</div>
        </Link>
        <Link to="/transfers" className="block hover:bg-parchment-50 p-2 -m-2">
          <div
            data-testid="home-active-offers-allowlist-number"
            className="font-mono text-2xl tabular-nums text-parchment-900"
          >
            {activeOffers}
          </div>
          <div className="text-xs uppercase tracking-wide text-parchment-500">Incoming offers</div>
        </Link>
      </div>
      <Link
        to="/scouts"
        className="mt-3 inline-block text-xs uppercase tracking-wide text-parchment-500 underline hover:text-parchment-900"
      >
        Scout the market
      </Link>
    </Card>
  );
}

// ── helpers ──────────────────────────────────────────────────────────────

interface FlatFixture {
  id: number;
  matchday: number;
  state: string;
  home: { id: number; name: string; goals: number | null };
  away: { id: number; name: string; goals: number | null };
  userResult: "W" | "D" | "L" | null;
  isHome: boolean;
}

function flatFixturesForClub(fx: Fixtures, clubId: number): FlatFixture[] {
  const out: FlatFixture[] = [];
  for (const md of fx.matchdays) {
    for (const f of md.fixtures) {
      if (f.home.id !== clubId && f.away.id !== clubId) continue;
      out.push({ ...f, isHome: f.home.id === clubId });
    }
  }
  return out;
}

function findLastResult(fx: Fixtures, clubId: number): FlatFixture | null {
  const all = flatFixturesForClub(fx, clubId);
  const played = all.filter((f) => f.state === "Played");
  if (played.length === 0) return null;
  return played[played.length - 1]!;
}

function findNextFixture(fx: Fixtures, clubId: number): FlatFixture | null {
  const all = flatFixturesForClub(fx, clubId);
  return all.find((f) => f.state === "Scheduled") ?? null;
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

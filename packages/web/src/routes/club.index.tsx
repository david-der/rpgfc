// /club — Club dashboard.
//
// First tab: Finances. Shows exact cash balance, wage bill, budget,
// plus season transfer activity. You always know your own club's
// finances precisely — opposing clubs show tier words only.

import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { SectionHeader } from "../components/ui/SectionHeader";
import { TabBar, type TabDefinition } from "../components/ui/TabBar";
import { fetchClubFinances, fetchClubLedger } from "../lib/api";

export const Route = createFileRoute("/club/")({
  component: ClubDashboard,
});

function ClubDashboard() {
  const tabs: TabDefinition[] = [
    { key: "finances", label: "Finances", content: <FinancesTab /> },
    { key: "ledger", label: "Ledger", content: <LedgerTab /> },
  ];

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <SectionHeader eyebrow="Club" title="Club" />
      <div className="mt-6">
        <TabBar tabs={tabs} />
      </div>
    </div>
  );
}

// Format cents as "$12.3M" / "$450K" / "$2.1B". Short form for the
// finance tiles — this is the user's own club, so numbers are fine.
function formatCents(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  if (abs >= 1_000_000_000_00) {
    return `${sign}$${(abs / 1_000_000_000_00).toFixed(1)}B`;
  }
  if (abs >= 1_000_000_00) {
    return `${sign}$${(abs / 1_000_000_00).toFixed(1)}M`;
  }
  if (abs >= 1_000_00) {
    return `${sign}$${(abs / 1_000_00).toFixed(0)}K`;
  }
  return `${sign}$${(abs / 100).toFixed(0)}`;
}

function FinancesTab() {
  const query = useQuery({ queryKey: ["club-finances"], queryFn: fetchClubFinances });

  if (query.isPending) return <p className="text-parchment-600">Loading…</p>;
  if (query.isError || !query.data) {
    return <p className="text-semantic-error">Could not load finances.</p>;
  }

  const f = query.data;
  const healthColor =
    f.wageBillVsBudget === "healthy"
      ? "text-moss-700 border-moss-600"
      : f.wageBillVsBudget === "tight"
        ? "text-parchment-800 border-parchment-600"
        : "text-clay-700 border-clay-600";
  const healthLabel =
    f.wageBillVsBudget === "healthy"
      ? "Healthy"
      : f.wageBillVsBudget === "tight"
        ? "Tight"
        : "Overspent";

  const budgetUsedPct =
    f.wageBudgetCents > 0 ? Math.round((f.wageBillCents / f.wageBudgetCents) * 100) : 0;

  return (
    <div className="space-y-8">
      {/* Club identity row */}
      <div className="border-b border-parchment-300 pb-4">
        <div className="text-xs uppercase tracking-wide text-parchment-500">
          {f.reputationTier} club
        </div>
        <h2 className="mt-1 font-serif text-2xl text-parchment-900">{f.clubName}</h2>
      </div>

      {/* Finance tiles — real numbers for the user's own club. */}
      <section>
        <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-parchment-500">
          Balance sheet
        </h3>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <FinanceTile
            label="Cash reserve"
            value={formatCents(f.cashCents)}
            tier={f.cashTier}
            accent="moss"
          />
          <FinanceTile
            label="Weekly wages"
            value={formatCents(f.wageBillCents)}
            tier={f.wageBillTier}
            accent="parchment"
          />
          <FinanceTile
            label="Weekly budget"
            value={formatCents(f.wageBudgetCents)}
            tier={f.wageBudgetTier}
            accent="parchment"
          />
          <FinanceTile
            label="Projected annual wages"
            value={formatCents(f.projectedAnnualWageCents)}
            tier={null}
            accent="parchment"
            subtle
          />
          <FinanceTile
            label="Spent on transfers"
            value={formatCents(f.recentSpendingCents)}
            tier={f.recentSpendingTier}
            accent="clay"
          />
          <FinanceTile
            label="Earned from transfers"
            value={formatCents(f.recentIncomeCents)}
            tier={f.recentIncomeTier}
            accent="moss"
          />
        </div>
      </section>

      {/* Budget health */}
      <section>
        <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-parchment-500">
          Wage budget health
        </h3>
        <div className="flex items-center gap-4">
          <span
            className={`inline-flex h-7 items-center border px-3 font-sans text-xs font-semibold uppercase tracking-wide ${healthColor}`}
          >
            {healthLabel}
          </span>
          <span className="font-mono text-sm tabular-nums text-parchment-700">
            {budgetUsedPct}% of budget used
          </span>
        </div>
        {/* Simple progress bar */}
        <div className="mt-3 h-2 w-full bg-parchment-200">
          <div
            className={`h-full ${
              f.wageBillVsBudget === "healthy"
                ? "bg-moss-500"
                : f.wageBillVsBudget === "tight"
                  ? "bg-parchment-600"
                  : "bg-clay-500"
            }`}
            style={{ width: `${Math.min(100, budgetUsedPct)}%` }}
          />
        </div>
        <p className="mt-3 text-sm text-parchment-700">
          {f.wageBillVsBudget === "healthy" &&
            "You have room to sign more players without financial strain."}
          {f.wageBillVsBudget === "tight" &&
            "Wages are approaching the budget ceiling. New signings will need to be selective."}
          {f.wageBillVsBudget === "overspent" &&
            "Wages exceed the budget. Seller clubs will notice and demand premium fees."}
        </p>
      </section>
    </div>
  );
}

function FinanceTile({
  label,
  value,
  tier,
  accent,
  subtle,
}: {
  label: string;
  value: string;
  tier: string | null;
  accent: "moss" | "clay" | "parchment";
  subtle?: boolean;
}) {
  const border =
    accent === "moss"
      ? "border-moss-500"
      : accent === "clay"
        ? "border-clay-500"
        : "border-parchment-400";
  const text =
    accent === "moss"
      ? "text-moss-700"
      : accent === "clay"
        ? "text-clay-700"
        : "text-parchment-900";
  return (
    <div className={`border bg-parchment-50 p-4 ${border} ${subtle ? "opacity-80" : ""}`}>
      <div className="text-xs uppercase tracking-wide text-parchment-500">{label}</div>
      <div className={`mt-2 font-mono text-2xl font-semibold tabular-nums ${text}`}>
        {value}
      </div>
      {tier && (
        <div className="mt-1 text-xs italic text-parchment-500">{tier} tier</div>
      )}
    </div>
  );
}

// ── Ledger tab ───────────────────────────────────────────────────────────

const KIND_LABEL: Record<string, string> = {
  revenue_tv: "TV rights",
  revenue_sponsor: "Sponsorship",
  revenue_matchday: "Matchday",
  expense_wages: "Weekly wages",
  signing_bonus: "Signing bonus",
  transfer_in: "Transfer income",
  transfer_out: "Transfer fee",
};

function LedgerTab() {
  const query = useQuery({ queryKey: ["club-ledger"], queryFn: fetchClubLedger });

  if (query.isPending) return <p className="text-parchment-600">Loading…</p>;
  if (query.isError || !query.data) {
    return <p className="text-semantic-error">Could not load ledger.</p>;
  }
  const events = query.data.events;

  if (events.length === 0) {
    return (
      <p className="text-sm italic text-parchment-500">
        No finance events yet. Advance a match week to start recording income and expenses.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto border border-parchment-300 bg-parchment-50">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-parchment-300 bg-parchment-100 text-xs uppercase tracking-wide text-parchment-500">
            <th className="px-3 py-2">Season</th>
            <th className="px-3 py-2">Week</th>
            <th className="px-3 py-2">Kind</th>
            <th className="px-3 py-2">Note</th>
            <th className="px-3 py-2 text-right">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-parchment-200">
          {events.map((e) => {
            const positive = e.amount_cents > 0;
            return (
              <tr key={e.id} className="hover:bg-parchment-100">
                <td className="px-3 py-1.5 font-mono tabular-nums text-parchment-700">
                  {e.season}
                </td>
                <td className="px-3 py-1.5 font-mono tabular-nums text-parchment-700">
                  {e.match_week}
                </td>
                <td className="px-3 py-1.5 text-parchment-900">
                  {KIND_LABEL[e.kind] ?? e.kind}
                </td>
                <td className="px-3 py-1.5 text-xs italic text-parchment-500">
                  {e.note ?? ""}
                </td>
                <td
                  className={`px-3 py-1.5 text-right font-mono font-semibold tabular-nums ${
                    positive ? "text-moss-700" : "text-clay-700"
                  }`}
                >
                  {positive ? "+" : ""}
                  {formatCents(e.amount_cents)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

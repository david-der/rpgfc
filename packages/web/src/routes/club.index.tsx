// /club — Club dashboard.
//
// First tab: Finances. Shows cash, wage bill vs budget, recent
// spending and income. More tabs (board, facilities, history) to
// come later.

import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { SectionHeader } from "../components/ui/SectionHeader";
import { TabBar, type TabDefinition } from "../components/ui/TabBar";
import { fetchClubFinances } from "../lib/api";

export const Route = createFileRoute("/club/")({
  component: ClubDashboard,
});

function ClubDashboard() {
  const tabs: TabDefinition[] = [
    { key: "finances", label: "Finances", content: <FinancesTab /> },
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

// ── Finances tab ──────────────────────────────────────────────────────────

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

  return (
    <div className="space-y-8">
      {/* Club identity row */}
      <div className="border-b border-parchment-300 pb-4">
        <div className="text-xs uppercase tracking-wide text-parchment-500">
          {f.reputationTier} club
        </div>
        <h2 className="mt-1 font-serif text-2xl text-parchment-900">{f.clubName}</h2>
      </div>

      {/* Finance cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <FinanceCard label="Cash reserve" value={f.cashTier} accent="moss" />
        <FinanceCard label="Weekly wage bill" value={f.wageBillTier} accent="parchment" />
        <FinanceCard label="Weekly wage budget" value={f.wageBudgetTier} accent="parchment" />
        <FinanceCard
          label="Spent on transfers"
          value={f.recentSpendingTier}
          accent="clay"
          subtle
        />
        <FinanceCard
          label="Earned from transfers"
          value={f.recentIncomeTier}
          accent="moss"
          subtle
        />
      </div>

      {/* Budget health */}
      <div>
        <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-parchment-500">
          Wage budget health
        </h3>
        <div className="flex items-center gap-4">
          <span
            className={`inline-flex h-7 items-center border px-3 font-sans text-xs font-semibold uppercase tracking-wide ${healthColor}`}
          >
            {healthLabel}
          </span>
          <p className="text-sm text-parchment-700">
            {f.wageBillVsBudget === "healthy" &&
              "You have room to sign more players without financial strain."}
            {f.wageBillVsBudget === "tight" &&
              "Wages are approaching the budget ceiling. New signings will need to be selective."}
            {f.wageBillVsBudget === "overspent" &&
              "Wages exceed the budget. Seller clubs will notice and demand premium fees."}
          </p>
        </div>
      </div>
    </div>
  );
}

function FinanceCard({
  label,
  value,
  accent,
  subtle,
}: {
  label: string;
  value: string;
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
    <div
      className={`border bg-parchment-50 p-4 ${border} ${subtle ? "opacity-90" : ""}`}
    >
      <div className="text-xs uppercase tracking-wide text-parchment-500">{label}</div>
      <div className={`mt-2 font-serif text-2xl font-semibold ${text}`}>{value}</div>
    </div>
  );
}

// /league/clubs/$clubId — browse any club in the league.
//
// Shows the club identity, roster with contracts + form, recent
// matches, and finance tiers. Same shape for every club — in the
// current model you can see all data for everyone.

import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { usePlayerModal } from "../components/PlayerModalProvider";
import { SectionHeader } from "../components/ui/SectionHeader";
import { fetchClubDetail } from "../lib/api";

export const Route = createFileRoute("/league/clubs/$clubId")({
  component: ClubDetail,
});

function ClubDetail() {
  const modal = usePlayerModal();
  const { clubId } = Route.useParams();
  const query = useQuery({
    queryKey: ["club-detail", clubId],
    queryFn: () => fetchClubDetail(clubId),
  });

  if (query.isPending) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-10">
        <p className="text-parchment-600">Loading club…</p>
      </div>
    );
  }
  if (query.isError || !query.data) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-10">
        <p className="text-semantic-error">Could not load this club.</p>
      </div>
    );
  }

  const club = query.data;

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      {/* Breadcrumb back to league */}
      <div className="mb-4">
        <Link
          to="/league"
          className="text-xs uppercase tracking-wide text-parchment-500 hover:text-parchment-900"
        >
          ← League
        </Link>
      </div>

      <SectionHeader eyebrow={`${club.reputationTier} club`} title={club.clubName} />

      {/* Finance summary — tier words only for opposition clubs */}
      <section className="mt-8 grid gap-3 md:grid-cols-3">
        <FinanceChip label="Cash reserve" tier={club.cashTier} />
        <FinanceChip label="Weekly wage bill" tier={club.wageBillTier} />
        <FinanceChip label="Roster size" tier={`${club.roster.length} players`} />
      </section>

      {/* Roster */}
      <section className="mt-8">
        <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-parchment-500">
          Roster ({club.roster.length})
        </h2>
        <div className="overflow-x-auto border border-parchment-300 bg-parchment-50">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-parchment-300 bg-parchment-100 text-xs uppercase tracking-wide text-parchment-500">
                <th className="px-4 py-3">Player</th>
                <th className="px-2 py-3">Pos</th>
                <th className="px-2 py-3">Age</th>
                <th className="hidden px-2 py-3 md:table-cell">Role</th>
                <th className="hidden px-2 py-3 md:table-cell">Wage</th>
                <th className="hidden px-2 py-3 md:table-cell">Years</th>
                <th className="hidden px-2 py-3 lg:table-cell">Form</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-parchment-200">
              {club.roster.map((p) => (
                <tr key={p.playerId} className="hover:bg-parchment-100">
                  <td className="px-4 py-2">
                    <button
                      type="button"
                      onClick={() => modal.open(p.playerId)}
                      className="text-left font-serif text-base text-parchment-900 hover:text-moss-700"
                    >
                      <span data-testid="player-facing">{p.playerName}</span>
                    </button>
                  </td>
                  <td className="px-2 py-2 font-mono text-xs text-parchment-700">
                    {p.positionLabel}
                  </td>
                  <td className="px-2 py-2 font-mono tabular-nums text-parchment-700">
                    <span data-testid="player-age-allowlist-number">{p.age}</span>
                  </td>
                  <td className="hidden px-2 py-2 text-parchment-700 md:table-cell">
                    {p.squadRole ?? "—"}
                  </td>
                  <td className="hidden px-2 py-2 text-parchment-700 md:table-cell">
                    {p.seasonsRemaining !== null ? p.wageTier : "—"}
                  </td>
                  <td className="hidden px-2 py-2 text-parchment-700 md:table-cell">
                    {p.seasonsRemaining !== null ? (
                      <span
                        data-testid="seasons-remaining-allowlist-number"
                        className="font-mono tabular-nums"
                      >
                        {p.seasonsRemaining}
                      </span>
                    ) : (
                      "Free agent"
                    )}
                  </td>
                  <td className="hidden px-2 py-2 text-parchment-700 lg:table-cell">
                    {p.formTierLabel ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Recent matches */}
      {club.recentMatches.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-parchment-500">
            Recent form
          </h2>
          <div className="flex gap-1">
            {club.recentMatches
              .slice()
              .reverse()
              .map((m) => (
                <ResultChip key={m.matchId} result={m.result} />
              ))}
          </div>
          <div className="mt-4 divide-y divide-parchment-200 border border-parchment-300 bg-parchment-100">
            {club.recentMatches.map((m) => (
              <Link
                key={m.matchId}
                to="/matches/$id"
                params={{ id: String(m.matchId) }}
                className="block hover:bg-parchment-50"
              >
                <div className="flex items-center justify-between p-3 text-sm">
                  <span className="text-xs uppercase tracking-wide text-parchment-500">
                    MW{" "}
                    <span
                      data-testid="match-week-allowlist-number"
                      className="font-mono tabular-nums"
                    >
                      {m.matchday}
                    </span>
                  </span>
                  <div className="flex flex-1 items-center justify-center gap-3 text-parchment-900">
                    <span className="flex-1 text-right">{m.homeClubName}</span>
                    <span className="font-mono tabular-nums font-semibold">
                      <span data-testid="match-score-allowlist-number">{m.homeGoals}</span>
                      <span className="mx-1 text-parchment-400">–</span>
                      <span data-testid="match-score-allowlist-number">{m.awayGoals}</span>
                    </span>
                    <span className="flex-1 text-left">{m.awayClubName}</span>
                  </div>
                  <ResultChip result={m.result} />
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function FinanceChip({ label, tier }: { label: string; tier: string }) {
  return (
    <div className="border border-parchment-300 bg-parchment-50 p-3">
      <div className="text-xs uppercase tracking-wide text-parchment-500">{label}</div>
      <div className="mt-1 font-serif text-lg text-parchment-900">{tier}</div>
    </div>
  );
}

function ResultChip({ result }: { result: "W" | "D" | "L" }) {
  const cls =
    result === "W"
      ? "border-result-win bg-result-win text-parchment-50 font-bold"
      : result === "L"
        ? "border-result-loss bg-result-loss text-parchment-50 font-bold"
        : "border-parchment-500 bg-parchment-50 text-parchment-700 font-medium";
  return (
    <span
      className={`inline-flex h-6 w-6 items-center justify-center border font-mono text-xs uppercase tracking-wide ${cls}`}
    >
      {result}
    </span>
  );
}

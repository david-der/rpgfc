// /transfers/$playerId — Story 04 Editor archetype.
//
// Left: player identity preview (reuses the Story 01 RenderedPlayer).
// Right: BidComposer that posts a new bid via the typed RPC client.
// After the server responds, the result ribbon surfaces the outcome
// (Signed, SellerCountered, PlayerRejected, etc.) in prose.
//
// A dev-only "Force accept" button appears when a bid has been
// submitted — it calls the /bids/:id/force-accept endpoint so the
// Playwright flow can exercise the contract-writing path without
// matching the evaluators' happy path. Story 07 removes this once
// windows + the proper accept flow land.

import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { RenderedBid } from "@rpgfc/shared";

import { BadgeStack } from "../components/ui/BadgeStack";
import { BidComposer } from "../components/ui/BidComposer";
import {
  fetchClubFinances,
  fetchPlayer,
  fetchTransfers,
  forceAcceptBid,
  submitBid,
} from "../lib/api";

export const Route = createFileRoute("/transfers/$playerId")({
  component: TransfersPlayer,
});

function TransfersPlayer() {
  const { playerId } = Route.useParams();
  const queryClient = useQueryClient();

  const playerQuery = useQuery({
    queryKey: ["player", playerId],
    queryFn: () => fetchPlayer(playerId),
  });

  const transfersQuery = useQuery({
    queryKey: ["transfers"],
    queryFn: fetchTransfers,
  });
  const financesQuery = useQuery({
    queryKey: ["club-finances"],
    queryFn: fetchClubFinances,
  });

  const submitMutation = useMutation({
    mutationFn: (body: Parameters<typeof submitBid>[1]) => submitBid(playerId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transfers"] });
      queryClient.invalidateQueries({ queryKey: ["player", playerId] });
    },
  });

  const forceMutation = useMutation({
    mutationFn: (bidId: number) => forceAcceptBid(bidId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transfers"] });
      queryClient.invalidateQueries({ queryKey: ["player", playerId] });
    },
  });

  if (playerQuery.isPending || transfersQuery.isPending) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-10">
        <p className="text-parchment-600">Loading transfer preview…</p>
      </div>
    );
  }
  if (playerQuery.isError || !playerQuery.data) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-10">
        <p className="text-semantic-error">Could not load this player.</p>
      </div>
    );
  }

  const player = playerQuery.data;
  const listing = transfersQuery.data?.listings.find((l) => l.playerId === Number(playerId));
  const latestBid: RenderedBid | undefined = submitMutation.data ?? forceMutation.data ?? undefined;

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="grid gap-8 md:grid-cols-2">
        {/* Left column — player preview */}
        <section className="space-y-4">
          <header className="border-b border-parchment-300 pb-6">
            <div className="text-xs uppercase tracking-wide text-parchment-500">
              {player.positionLabel} · {player.nationality} ·{" "}
              {listing?.club.name ?? player.club?.name ?? "Free Agent"}
            </div>
            <h1 data-testid="player-facing" className="mt-1 font-serif text-3xl text-parchment-900">
              {player.name}
            </h1>
            <p
              data-testid="player-facing"
              className="mt-3 font-serif text-base leading-relaxed text-parchment-700"
            >
              {player.prose.identity}
            </p>
          </header>
          {listing && (
            <div className="text-xs uppercase tracking-wide text-parchment-500">
              Asking:{" "}
              <span data-testid="player-facing" className="ml-1 font-semibold text-parchment-900">
                {listing.askingTier}
              </span>
            </div>
          )}
          <div>
            <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-parchment-500">
              Badges
            </h2>
            <BadgeStack badges={player.badges} />
          </div>
        </section>

        {/* Right column — bid composer + result ribbon */}
        <section className="space-y-4">
          <BidComposer
            initialAskingTier={listing?.askingTier ?? "Notable"}
            busy={submitMutation.isPending}
            {...(financesQuery.data?.cashCents !== undefined
              ? { cashCents: financesQuery.data.cashCents }
              : {})}
            {...(financesQuery.data?.wageBillCents !== undefined
              ? { weeklyWageCents: financesQuery.data.wageBillCents }
              : {})}
            onSubmit={async (value) => {
              await submitMutation.mutateAsync(value);
            }}
          />

          {latestBid && (
            <div
              data-testid="bid-result"
              className="border border-parchment-300 bg-parchment-50 p-4 font-sans text-sm text-parchment-800"
            >
              <div className="text-xs uppercase tracking-wide text-parchment-500">
                Bid #{latestBid.id}
              </div>
              <div className="mt-1 font-semibold uppercase tracking-wide text-parchment-900">
                {latestBid.state}
              </div>
              {latestBid.rejectionReasonLabel && (
                <p className="mt-2 italic text-parchment-700">{latestBid.rejectionReasonLabel}</p>
              )}
              {latestBid.state !== "Signed" && (
                <button
                  type="button"
                  onClick={() => forceMutation.mutate(latestBid.id)}
                  disabled={forceMutation.isPending}
                  className="mt-3 border border-clay-500 bg-parchment-50 px-3 py-1 font-sans text-xs font-semibold uppercase tracking-wide text-clay-700 outline-offset-2 transition-colors hover:bg-clay-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-moss-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {forceMutation.isPending ? "Forcing…" : "Dev: force accept"}
                </button>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

// /transfers — Story 04 List archetype.
//
// Two sections: pending bids by the user's club at the top, followed
// by the full listings feed. The listings come pre-sorted so any
// active-bid entries float to the top of the listings section.

import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { ListingCard } from "../components/ui/ListingCard";
import { SectionHeader } from "../components/ui/SectionHeader";
import { fetchTransfers } from "../lib/api";

export const Route = createFileRoute("/transfers/")({
  component: TransfersList,
});

function TransfersList() {
  const query = useQuery({
    queryKey: ["transfers"],
    queryFn: fetchTransfers,
  });

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <SectionHeader eyebrow="Story 04" title="Transfer market" />

      {query.isPending && <p className="mt-8 text-parchment-600">Loading the market…</p>}
      {query.isError && (
        <p className="mt-8 text-semantic-error">Could not load transfer listings.</p>
      )}

      {query.data && (
        <>
          {query.data.pending.length > 0 && (
            <section className="mt-8">
              <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-parchment-500">
                Your pending bids
              </h2>
              <div className="space-y-2">
                {query.data.pending.map((bid) => (
                  <div
                    key={bid.id}
                    className="border border-parchment-300 bg-parchment-50 p-4 font-sans text-sm text-parchment-700"
                  >
                    <span className="font-semibold text-parchment-900">Bid #{bid.id}</span> —{" "}
                    <span className="uppercase tracking-wide">{bid.state}</span> at the{" "}
                    <span className="italic">{bid.currentProposal.feeTier}</span> tier
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="mt-8">
            <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-parchment-500">
              Listings ({query.data.listings.length})
            </h2>
            <div className="space-y-4">
              {query.data.listings.map((listing) => (
                <ListingCard key={listing.playerId} listing={listing} />
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

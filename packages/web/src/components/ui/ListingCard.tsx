// ListingCard — Story 04 List-archetype row for /transfers.
//
// Composes a row with player identity + asking tier + current bid state.
// The whole card is a TanStack Router Link to /transfers/$playerId.
//
// Qualitative tier words everywhere — no cents, no currency glyphs.

import { Link } from "@tanstack/react-router";

import type { BidState, CurrencyTier, RenderedListing } from "@rpgfc/shared";

interface ListingCardProps {
  listing: RenderedListing;
}

const REASON_LABEL: Record<RenderedListing["reason"], string> = {
  rebuild: "Rebuild",
  wage_trim: "Wage trim",
  squad_overhaul: "Squad overhaul",
};

const STATE_LABEL: Partial<Record<BidState, string>> = {
  Draft: "Draft",
  Submitted: "Submitted",
  SellerReviewing: "With seller",
  SellerCountered: "Seller countered",
  SellerAccepted: "Waiting on player",
  SellerRejected: "Seller rejected",
  PlayerReviewing: "With player",
  PlayerAccepted: "Player accepted",
  PlayerRejected: "Player rejected",
  Signed: "Signed",
  Expired: "Expired",
};

const TIER_PILL_CLASS: Record<CurrencyTier, string> = {
  Minimal: "bg-parchment-50 text-parchment-700 border-parchment-400",
  Modest: "bg-parchment-50 text-moss-700 border-moss-500",
  Notable: "bg-parchment-50 text-moss-700 border-moss-600",
  Significant: "bg-parchment-50 text-clay-700 border-clay-500",
  Elite: "bg-clay-500 text-parchment-50 border-clay-500",
};

export function ListingCard({ listing }: ListingCardProps) {
  return (
    <article className="border border-parchment-300 bg-parchment-100 p-6 transition-colors hover:border-parchment-700">
      <Link
        to="/transfers/$playerId"
        params={{ playerId: String(listing.playerId) }}
        className="block outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-moss-600"
      >
        <header className="flex items-baseline justify-between border-b border-parchment-200 pb-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-parchment-500">
              <span>{listing.positionLabel}</span>
              <span className="mx-2">·</span>
              <span data-testid="age-allowlist-number" className="font-mono tabular-nums">
                {listing.age}
              </span>
              <span className="ml-1">yrs</span>
              <span className="mx-2">·</span>
              <span>{listing.nationality}</span>
            </div>
            <h3 data-testid="player-facing" className="mt-1 font-serif text-xl text-parchment-900">
              {listing.playerName}
            </h3>
          </div>
          <div className="text-right">
            <div className="text-xs uppercase tracking-wide text-parchment-500">
              {listing.club.name}
            </div>
            <div className="mt-1 text-xs italic text-parchment-500">
              {REASON_LABEL[listing.reason]}
            </div>
          </div>
        </header>

        <footer className="mt-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wide text-parchment-500">Asking</span>
            <span
              data-testid="player-facing"
              className={`inline-flex h-6 items-center border px-2 font-sans text-xs font-semibold uppercase tracking-wide ${TIER_PILL_CLASS[listing.askingTier]}`}
            >
              {listing.askingTier}
            </span>
          </div>
          {listing.currentBidState && (
            <div className="text-xs uppercase tracking-wide text-parchment-700">
              {STATE_LABEL[listing.currentBidState] ?? listing.currentBidState}
            </div>
          )}
        </footer>
      </Link>
    </article>
  );
}

// /transfers — Transfer Dashboard with five tabs.
//
// Market: browse all listed players.
// My Bids: outgoing offers with state + countdown.
// Offers: incoming bids on the user's players.
// Watchlist: bookmarked players the user is tracking.
// Completed: recent signings in and out.

import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ListingCard } from "../components/ui/ListingCard";
import { SectionHeader } from "../components/ui/SectionHeader";
import { TabBar, type TabDefinition } from "../components/ui/TabBar";
import {
  fetchCompletedDeals,
  fetchMyBids,
  fetchOffers,
  fetchTransfers,
  fetchWatchlist,
  removeFromWatchlist,
} from "../lib/api";

export const Route = createFileRoute("/transfers/")({
  component: TransferDashboard,
});

const BID_STATE_LABELS: Record<string, string> = {
  Submitted: "Pending",
  SellerReviewing: "Under review",
  SellerAccepted: "Seller agreed — awaiting player",
  SellerRejected: "Rejected by club",
  SellerCountered: "Counter-offer received",
  PlayerReviewing: "Player considering",
  PlayerAccepted: "Player agreed",
  PlayerRejected: "Player declined",
  Signed: "Signed",
  Expired: "Expired",
  Cancelled: "Cancelled",
};

const STATE_COLOR: Record<string, string> = {
  Submitted: "text-parchment-700 border-parchment-400",
  SellerReviewing: "text-parchment-700 border-parchment-400",
  SellerAccepted: "text-moss-700 border-moss-500",
  SellerRejected: "text-clay-700 border-clay-500",
  SellerCountered: "text-parchment-900 border-parchment-500",
  PlayerReviewing: "text-parchment-700 border-parchment-400",
  PlayerAccepted: "text-moss-700 border-moss-500",
  PlayerRejected: "text-clay-700 border-clay-500",
  Signed: "text-moss-700 border-moss-600 font-semibold",
  Expired: "text-parchment-500 border-parchment-300 italic",
  Cancelled: "text-parchment-500 border-parchment-300 italic",
};

function TransferDashboard() {
  const tabs: TabDefinition[] = [
    { key: "market", label: "Market", content: <MarketTab /> },
    { key: "my-bids", label: "My Bids", content: <MyBidsTab /> },
    { key: "offers", label: "Offers", content: <OffersTab /> },
    { key: "watchlist", label: "Watchlist", content: <WatchlistTab /> },
    { key: "completed", label: "Completed", content: <CompletedTab /> },
  ];

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <SectionHeader eyebrow="Transfers" title="Transfer market" />
      <div className="mt-6">
        <TabBar tabs={tabs} />
      </div>
    </div>
  );
}

// ── Market tab ────────────────────────────────────────────────────────────

function MarketTab() {
  const query = useQuery({ queryKey: ["transfers"], queryFn: fetchTransfers });

  if (query.isPending) return <p className="text-parchment-600">Loading…</p>;
  if (query.isError) return <p className="text-semantic-error">Could not load listings.</p>;

  return (
    <div className="space-y-4">
      <h2 className="text-xs font-medium uppercase tracking-wide text-parchment-500">
        Listings ({query.data.listings.length})
      </h2>
      <div className="space-y-3">
        {query.data.listings.map((listing) => (
          <ListingCard key={listing.playerId} listing={listing} />
        ))}
      </div>
    </div>
  );
}

// ── My Bids tab ───────────────────────────────────────────────────────────

function MyBidsTab() {
  const query = useQuery({ queryKey: ["my-bids"], queryFn: fetchMyBids });

  if (query.isPending) return <p className="text-parchment-600">Loading…</p>;
  if (query.isError) return <p className="text-semantic-error">Could not load bids.</p>;

  const { bids, currentMatchWeek } = query.data;
  const active = bids.filter(
    (b: { state: string }) =>
      !["Signed", "Expired", "Cancelled", "SellerRejected", "PlayerRejected"].includes(b.state),
  );
  const resolved = bids.filter(
    (b: { state: string }) =>
      ["Signed", "Expired", "Cancelled", "SellerRejected", "PlayerRejected"].includes(b.state),
  );

  return (
    <div className="space-y-6">
      {active.length > 0 && (
        <section>
          <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-parchment-500">
            Active ({active.length})
          </h2>
          <div className="space-y-2">
            {active.map((bid: BidItem) => (
              <BidCard key={bid.id} bid={bid} currentMatchWeek={currentMatchWeek} />
            ))}
          </div>
        </section>
      )}
      {resolved.length > 0 && (
        <section>
          <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-parchment-500">
            Resolved ({resolved.length})
          </h2>
          <div className="space-y-2">
            {resolved.map((bid: BidItem) => (
              <BidCard key={bid.id} bid={bid} currentMatchWeek={currentMatchWeek} />
            ))}
          </div>
        </section>
      )}
      {bids.length === 0 && (
        <p className="text-sm italic text-parchment-500">
          No bids yet. Browse the Market or use Scouting to find players.
        </p>
      )}
    </div>
  );
}

interface BidItem {
  id: number;
  player_id: number;
  player_name: string;
  to_club_name: string;
  state: string;
  stance: string;
  role_promise: string;
  submitted_match_week: number | null;
  deadline_match_week: number | null;
  rejection_reason: string | null;
}

function BidCard({ bid, currentMatchWeek }: { bid: BidItem; currentMatchWeek: number }) {
  const deadline = bid.deadline_match_week ?? 0;
  const weeksLeft = Math.max(0, deadline - currentMatchWeek);
  const isActive = !["Signed", "Expired", "Cancelled", "SellerRejected", "PlayerRejected"].includes(
    bid.state,
  );

  return (
    <div className="flex items-start justify-between border border-parchment-300 bg-parchment-100 p-4">
      <div className="min-w-0 flex-1">
        <Link
          to="/players/$id"
          params={{ id: String(bid.player_id) }}
          className="font-serif text-lg text-parchment-900 hover:text-moss-700"
        >
          <span data-testid="player-facing">{bid.player_name}</span>
        </Link>
        <div className="mt-1 text-xs text-parchment-500">
          from {bid.to_club_name} · {bid.role_promise}
        </div>
      </div>
      <div className="flex flex-col items-end gap-1">
        <span
          className={`inline-flex border px-2 py-0.5 font-sans text-xs uppercase tracking-wide ${STATE_COLOR[bid.state] ?? "text-parchment-700"}`}
        >
          {BID_STATE_LABELS[bid.state] ?? bid.state}
        </span>
        {isActive && weeksLeft > 0 && (
          <span className="text-[10px] text-parchment-500">
            {weeksLeft} match week{weeksLeft !== 1 ? "s" : ""} left
          </span>
        )}
      </div>
    </div>
  );
}

// ── Offers tab ────────────────────────────────────────────────────────────

function OffersTab() {
  const query = useQuery({ queryKey: ["offers"], queryFn: fetchOffers });

  if (query.isPending) return <p className="text-parchment-600">Loading…</p>;
  if (query.isError) return <p className="text-semantic-error">Could not load offers.</p>;

  const { offers } = query.data;
  if (offers.length === 0) {
    return (
      <p className="text-sm italic text-parchment-500">
        No incoming offers on your players. Other clubs will bid as the market evolves.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {offers.map((offer: BidItem) => (
        <div
          key={offer.id}
          className="flex items-start justify-between border border-parchment-300 bg-parchment-100 p-4"
        >
          <div>
            <div className="font-serif text-base text-parchment-900">
              <span data-testid="player-facing">{offer.player_name}</span>
            </div>
            <div className="mt-1 text-xs text-parchment-500">
              Bid from {offer.to_club_name}
            </div>
          </div>
          <span
            className={`border px-2 py-0.5 font-sans text-xs uppercase tracking-wide ${STATE_COLOR[offer.state] ?? ""}`}
          >
            {BID_STATE_LABELS[offer.state] ?? offer.state}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Watchlist tab ─────────────────────────────────────────────────────────

function WatchlistTab() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["watchlist"], queryFn: fetchWatchlist });
  const removeMutation = useMutation({
    mutationFn: removeFromWatchlist,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["watchlist"] }),
  });

  if (query.isPending) return <p className="text-parchment-600">Loading…</p>;
  if (query.isError) return <p className="text-semantic-error">Could not load watchlist.</p>;

  const { items } = query.data;
  if (items.length === 0) {
    return (
      <p className="text-sm italic text-parchment-500">
        Your watchlist is empty. Use the Scouting page to find and track players.
      </p>
    );
  }

  return (
    <div className="divide-y divide-parchment-200 border border-parchment-300 bg-parchment-100">
      {items.map((item: WatchlistItem) => (
        <div key={item.player_id} className="flex items-center justify-between p-4">
          <div>
            <Link
              to="/players/$id"
              params={{ id: String(item.player_id) }}
              className="font-serif text-base text-parchment-900 hover:text-moss-700"
            >
              <span data-testid="player-facing">{item.player_name}</span>
            </Link>
            <div className="mt-1 text-xs text-parchment-500">
              {item.nationality}
              {item.club_name && <> · {item.club_name}</>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/transfers/$playerId"
              params={{ playerId: String(item.player_id) }}
              className="border border-moss-500 bg-parchment-50 px-2 py-1 font-sans text-xs font-medium uppercase tracking-wide text-moss-700 hover:bg-moss-50"
            >
              Bid
            </Link>
            <button
              type="button"
              onClick={() => removeMutation.mutate(item.player_id)}
              disabled={removeMutation.isPending}
              className="border border-parchment-400 bg-parchment-50 px-2 py-1 font-sans text-xs text-parchment-500 hover:text-clay-700"
            >
              Remove
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

interface WatchlistItem {
  player_id: number;
  player_name: string;
  position_label: string;
  nationality: string;
  club_name: string | null;
}

// ── Completed tab ─────────────────────────────────────────────────────────

function CompletedTab() {
  const query = useQuery({ queryKey: ["completed-deals"], queryFn: fetchCompletedDeals });

  if (query.isPending) return <p className="text-parchment-600">Loading…</p>;
  if (query.isError) return <p className="text-semantic-error">Could not load deals.</p>;

  const { deals } = query.data;
  if (deals.length === 0) {
    return (
      <p className="text-sm italic text-parchment-500">
        No completed transfers yet this season.
      </p>
    );
  }

  return (
    <div className="divide-y divide-parchment-200 border border-parchment-300 bg-parchment-100">
      {deals.map((deal: CompletedDeal) => (
        <div key={deal.bid_id} className="flex items-center justify-between p-4">
          <div>
            <Link
              to="/players/$id"
              params={{ id: String(deal.player_id) }}
              className="font-serif text-base text-parchment-900 hover:text-moss-700"
            >
              <span data-testid="player-facing">{deal.player_name}</span>
            </Link>
            <div className="mt-1 text-xs text-parchment-500">
              {deal.from_club_name} → {deal.to_club_name} · {deal.role_promise}
            </div>
          </div>
          <span className="border border-moss-600 bg-moss-500 px-2 py-0.5 font-sans text-xs font-semibold uppercase tracking-wide text-parchment-50">
            Signed
          </span>
        </div>
      ))}
    </div>
  );
}

interface CompletedDeal {
  bid_id: number;
  player_id: number;
  player_name: string;
  from_club_name: string;
  to_club_name: string;
  role_promise: string;
}

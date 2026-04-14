// /transfers — Transfer Dashboard with five tabs.
//
// Market: browse all listed players.
// My Bids: outgoing offers with state + countdown.
// Offers: incoming bids on the user's players.
// Watchlist: bookmarked players the user is tracking.
// Completed: recent signings in and out.

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { usePlayerModal } from "../components/PlayerModalProvider";
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

const TRANSFER_TABS = ["market", "my-bids", "offers", "watchlist", "completed"] as const;
type TransferTab = (typeof TRANSFER_TABS)[number];

export const Route = createFileRoute("/transfers/")({
  component: TransferDashboard,
  validateSearch: (search: Record<string, unknown>): { tab?: TransferTab } => {
    const raw = search["tab"];
    return typeof raw === "string" && (TRANSFER_TABS as readonly string[]).includes(raw)
      ? { tab: raw as TransferTab }
      : {};
  },
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
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const activeTab: TransferTab = search.tab ?? "market";

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
        <TabBar
          tabs={tabs}
          activeKey={activeTab}
          onChange={(key) => {
            void navigate({
              search: key === "market" ? {} : { tab: key as TransferTab },
            });
          }}
        />
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
  from_club_name: string;
  to_club_name: string;
  state: string;
  stance: string;
  role_promise: string;
  submitted_match_week: number | null;
  deadline_match_week: number | null;
  rejection_reason: string | null;
}

function BidCard({ bid, currentMatchWeek }: { bid: BidItem; currentMatchWeek: number }) {
  const modal = usePlayerModal();
  const deadline = bid.deadline_match_week ?? 0;
  const weeksLeft = Math.max(0, deadline - currentMatchWeek);
  const isResolved = ["Signed", "Expired", "Cancelled", "SellerRejected", "PlayerRejected"].includes(
    bid.state,
  );
  const isRejected = bid.state === "SellerRejected" || bid.state === "PlayerRejected";
  const prose = bid.rejection_reason ? REJECTION_PROSE[bid.rejection_reason] : null;

  return (
    <div className="flex items-start justify-between border border-parchment-300 bg-parchment-100 p-4">
      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={() => modal.open(bid.player_id)}
          className="text-left font-serif text-lg text-parchment-900 hover:text-moss-700"
        >
          <span data-testid="player-facing">{bid.player_name}</span>
        </button>
        <div className="mt-1 text-xs text-parchment-500">
          from {bid.to_club_name} · {bid.role_promise}
        </div>
        {isRejected && prose && (
          <p
            data-testid="player-facing"
            className="mt-2 max-w-prose font-serif text-sm italic text-parchment-700"
          >
            &ldquo;{prose}&rdquo;
          </p>
        )}
      </div>
      <div className="flex flex-col items-end gap-1">
        <span
          className={`inline-flex border px-2 py-0.5 font-sans text-xs uppercase tracking-wide ${STATE_COLOR[bid.state] ?? "text-parchment-700"}`}
        >
          {BID_STATE_LABELS[bid.state] ?? bid.state}
        </span>
        {!isResolved && weeksLeft > 0 && (
          <span className="text-[10px] text-parchment-500">
            {weeksLeft} match week{weeksLeft !== 1 ? "s" : ""} left
          </span>
        )}
        {isRejected && (
          <Link
            to="/transfers/$playerId"
            params={{ playerId: String(bid.player_id) }}
            className="mt-1 border border-moss-600 bg-moss-500 px-2 py-0.5 font-sans text-xs font-semibold uppercase tracking-wide text-parchment-50 hover:bg-moss-600"
          >
            Re-offer
          </Link>
        )}
      </div>
    </div>
  );
}

/** Paraphrased rejection-reason copy (mirrors server REJECTION_PROSE).
 *  Kept client-side so the UI can render immediately without a round-trip.
 *  Must stay in sync with packages/server/src/application/transfers/evaluators.ts. */
const REJECTION_PROSE: Record<string, string> = {
  SELLER_FEE_TOO_LOW: "The selling club laughed the offer out of the room.",
  SELLER_BUDGET_STRAIN:
    "The selling club will not consider a move they cannot replace financially.",
  PLAYER_WAGE_FLOOR: "He expects a proper reward for a player at his level.",
  PLAYER_PLAYING_TIME: "He wants more game time than this club can realistically offer.",
  PLAYER_FORBIDDEN_CLUB: "He would not play for this club under any terms.",
  PLAYER_REGION_MISMATCH: "He is not willing to move to that part of the world.",
};

// ── Offers tab ────────────────────────────────────────────────────────────

function OffersTab() {
  const modal = usePlayerModal();
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
      {offers.map((offer: BidItem) => {
        const prose = offer.rejection_reason ? REJECTION_PROSE[offer.rejection_reason] : null;
        const isRejected = offer.state === "SellerRejected" || offer.state === "PlayerRejected";
        return (
        <div
          key={offer.id}
          className="flex items-start justify-between border border-parchment-300 bg-parchment-100 p-4"
        >
          <div className="min-w-0 flex-1">
            <button
              type="button"
              onClick={() => modal.open(offer.player_id)}
              className="block text-left font-serif text-base text-parchment-900 hover:text-moss-700"
            >
              <span data-testid="player-facing">{offer.player_name}</span>
            </button>
            <div className="mt-1 text-xs text-parchment-500">
              Bid from {offer.from_club_name}
            </div>
            {isRejected && prose && (
              <p
                data-testid="player-facing"
                className="mt-2 max-w-prose font-serif text-sm italic text-parchment-700"
              >
                &ldquo;{prose}&rdquo;
              </p>
            )}
          </div>
          <span
            className={`border px-2 py-0.5 font-sans text-xs uppercase tracking-wide ${STATE_COLOR[offer.state] ?? ""}`}
          >
            {BID_STATE_LABELS[offer.state] ?? offer.state}
          </span>
        </div>
        );
      })}
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

  const modal = usePlayerModal();
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
            <button
              type="button"
              onClick={() => modal.open(item.player_id)}
              className="text-left font-serif text-base text-parchment-900 hover:text-moss-700"
            >
              <span data-testid="player-facing">{item.player_name}</span>
            </button>
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
  const modal = usePlayerModal();
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
            <button
              type="button"
              onClick={() => modal.open(deal.player_id)}
              className="text-left font-serif text-base text-parchment-900 hover:text-moss-700"
            >
              <span data-testid="player-facing">{deal.player_name}</span>
            </button>
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

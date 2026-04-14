// Two-sided player preview modal.
//
// Front: trading-card illustration + identity + dimensions + contract
//        + mood — everything you'd see on the front of a Panini sticker.
// Back:  career totals + per-season history table (matches played,
//        goals, assists, minutes, discipline).
//
// Triggered from any row where a player is a line item (squad, scouts,
// watchlist, bids, offers). Shares the same `/player-art/{id}.png`
// pipeline as PlayerCard + PlayerAvatar.

import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { BadgeStack } from "./BadgeStack";
import { CertaintyText } from "./CertaintyText";
import { PlayerCard } from "./PlayerCard";
import { PromiseMoodChip } from "./PromiseMoodChip";
import { TierPill } from "./TierPill";
import type { PromiseMood } from "@rpgfc/shared";

import {
  fetchPlayer,
  fetchPlayerContract,
  fetchPlayerHistory,
} from "../../lib/api";

type Face = "front" | "back";

export function PlayerModal({
  playerId,
  onClose,
}: {
  playerId: number;
  onClose: () => void;
}) {
  const [face, setFace] = useState<Face>("front");
  const id = String(playerId);

  const playerQ = useQuery({ queryKey: ["player", id], queryFn: () => fetchPlayer(id) });
  const contractQ = useQuery({
    queryKey: ["player-contract", id],
    queryFn: () => fetchPlayerContract(id),
  });
  const historyQ = useQuery({
    queryKey: ["player-history", id],
    queryFn: () => fetchPlayerHistory(id),
  });

  // Escape to close — classic modal ergonomics.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    // Prevent body scroll while the modal is open.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handler);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const player = playerQ.data;
  const contract = contractQ.data?.contract ?? null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Player preview"
      data-testid="player-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={(e) => {
        // Backdrop click closes.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-4xl overflow-hidden border-2 border-parchment-900 bg-parchment-50">
        {/* Header strip — carries identity even on the back face so the
            reader keeps their anchor when flipping. */}
        <div className="flex items-center justify-between border-b border-parchment-300 bg-parchment-100 px-4 py-2">
          <div className="min-w-0">
            <div className="font-mono text-[10px] uppercase tracking-wider text-parchment-500">
              {face === "front" ? "Player profile" : "Career so far"}
            </div>
            {player && (
              <div className="truncate font-serif text-sm text-parchment-900">
                <span data-testid="player-facing">{player.name}</span>
                <span className="ml-2 text-xs uppercase tracking-wide text-parchment-500">
                  {player.positionLabel} · {player.nationality}
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              data-testid="player-modal-flip"
              onClick={() => setFace(face === "front" ? "back" : "front")}
              className="border border-parchment-600 px-3 py-1 font-sans text-xs font-semibold uppercase tracking-wide text-parchment-800 hover:bg-parchment-50"
            >
              {face === "front" ? "Flip to career" : "Flip to front"}
            </button>
            <button
              type="button"
              data-testid="player-modal-close"
              onClick={onClose}
              aria-label="Close"
              className="border border-parchment-600 px-2 py-1 font-mono text-xs font-semibold uppercase tracking-wide text-parchment-800 hover:bg-parchment-50"
            >
              ✕
            </button>
          </div>
        </div>

        {playerQ.isPending || !player ? (
          <div className="p-10 text-center text-parchment-500">Loading player…</div>
        ) : face === "front" ? (
          <FrontFace
            player={player}
            contract={contract}
            onOpenFullProfile={onClose}
          />
        ) : (
          <BackFace history={historyQ.data?.seasons ?? []} loading={historyQ.isPending} />
        )}
      </div>
    </div>
  );
}

// ── FRONT ────────────────────────────────────────────────────────────────

function FrontFace({
  player,
  contract,
  onOpenFullProfile,
}: {
  player: NonNullable<Awaited<ReturnType<typeof fetchPlayer>>>;
  contract: { wageTier: string; rolePromise: string; seasonsRemaining: number } | null;
  onOpenFullProfile: () => void;
}) {
  const seasonsLeft = contract?.seasonsRemaining ?? null;
  return (
    <div className="grid gap-0 p-0 md:grid-cols-[280px_1fr]">
      {/* Left column: big trading card, no right border redundancy. */}
      <div className="border-b border-parchment-300 bg-parchment-100 p-6 md:border-b-0 md:border-r">
        <PlayerCard
          playerId={player.id}
          playerName={player.name}
          positionLabel={player.positionLabel}
          nationality={player.nationality}
          age={player.age}
          club={player.club}
          certaintyLabel={player.certainty}
        />
      </div>

      {/* Right column: identity, prose, dimensions, mood, badges, CTA. */}
      <div className="min-w-0 space-y-5 p-6">
        <div>
          <h2
            data-testid="player-facing"
            className="font-serif text-3xl leading-tight text-parchment-900"
          >
            {player.name}
          </h2>
          <p
            data-testid="player-facing"
            className="mt-2 max-w-prose font-serif text-base leading-relaxed text-parchment-700"
          >
            {player.prose.identity}
          </p>
          <p className="mt-2 text-xs uppercase tracking-wide text-parchment-500">
            Known <CertaintyText certainty={player.certainty}>{player.certainty}</CertaintyText>
          </p>
        </div>

        {/* Dimensions strip. Wage/seasons show "—" cleanly for free agents. */}
        <div className="grid grid-cols-2 gap-3 border-t border-parchment-300 pt-4 text-xs sm:grid-cols-4">
          <Stat label="Age" value={String(player.age)} allowlist="age" />
          <Stat label="Foot" value={player.preferredFoot} />
          <Stat
            label="Career"
            value={<TierPill tier={player.experience} />}
          />
          <Stat
            label="Wage"
            value={contract?.wageTier ?? "—"}
          />
        </div>
        {seasonsLeft !== null && (
          <div className="text-xs uppercase tracking-wide text-parchment-500">
            Contract:{" "}
            <span
              data-testid="modal-seasons-left-allowlist-number"
              className="font-mono tabular-nums font-semibold text-parchment-900"
            >
              {seasonsLeft}
            </span>{" "}
            {seasonsLeft === 1 ? "season" : "seasons"} left ·{" "}
            {contract?.rolePromise && (
              <span className="font-semibold text-parchment-900">{contract.rolePromise}</span>
            )}
          </div>
        )}
        {contract === null && (
          <div className="text-xs italic text-parchment-500">
            Free agent — no contract on file.
          </div>
        )}

        {player.promiseMood && player.promiseMoodLabel && (
          <div>
            <PromiseMoodChip
              mood={player.promiseMood as PromiseMood}
              label={player.promiseMoodLabel}
            />
          </div>
        )}

        {player.badges.length > 0 && (
          <div>
            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-parchment-500">
              Badges
            </div>
            <BadgeStack badges={player.badges} />
          </div>
        )}

        <div className="flex items-center gap-3 border-t border-parchment-300 pt-4">
          <Link
            to="/players/$id"
            params={{ id: String(player.id) }}
            onClick={onOpenFullProfile}
            className="border border-moss-600 bg-moss-500 px-3 py-1.5 font-sans text-xs font-semibold uppercase tracking-wide text-parchment-50 hover:bg-moss-600"
          >
            Open full profile
          </Link>
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  allowlist,
}: {
  label: string;
  value: React.ReactNode;
  allowlist?: string;
}) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-wide text-parchment-500">{label}</span>
      <span
        className="mt-0.5 font-mono text-sm tabular-nums text-parchment-900"
        {...(allowlist
          ? { "data-testid": `modal-${allowlist}-allowlist-number` }
          : {})}
      >
        {value}
      </span>
    </div>
  );
}

// ── BACK ─────────────────────────────────────────────────────────────────

type HistorySeason = Awaited<ReturnType<typeof fetchPlayerHistory>>["seasons"][number];

function BackFace({
  history,
  loading,
}: {
  history: HistorySeason[];
  loading: boolean;
}) {
  if (loading) {
    return <div className="p-10 text-center text-parchment-500">Loading history…</div>;
  }
  if (history.length === 0) {
    return (
      <div className="p-10 text-center text-sm italic text-parchment-500">
        No matches played yet. Their story starts this season.
      </div>
    );
  }
  const totalApps = history.reduce((s, r) => s + r.appearances, 0);
  const totalGoals = history.reduce((s, r) => s + r.goals, 0);
  const totalAssists = history.reduce((s, r) => s + r.assists, 0);
  const totalMins = history.reduce((s, r) => s + r.minutes, 0);
  const avgGoals = history.length > 0 ? (totalGoals / history.length).toFixed(1) : "0.0";
  return (
    <div className="p-6">
      {/* Career banner — heavier presence than a data strip; announces
          that the stats on this face are the lifetime-so-far ledger. */}
      <div className="border-2 border-parchment-900 bg-parchment-100">
        <div className="border-b border-parchment-300 bg-parchment-50 px-4 py-2">
          <div className="font-mono text-xs uppercase tracking-wider text-parchment-600">
            Career totals
          </div>
        </div>
        <div className="grid grid-cols-2 gap-0 divide-x divide-y divide-parchment-300 sm:grid-cols-5 sm:divide-y-0">
          <StatBlock label="Apps" value={totalApps} allowlist="modal-total-apps" />
          <StatBlock label="Goals" value={totalGoals} allowlist="modal-total-goals" accent />
          <StatBlock label="Assists" value={totalAssists} allowlist="modal-total-assists" />
          <StatBlock label="Seasons" value={history.length} allowlist="modal-total-seasons" />
          <StatBlock
            label="Goals / season"
            value={avgGoals}
            allowlist="modal-avg-goals"
          />
        </div>
        <div className="border-t border-parchment-300 bg-parchment-50 px-4 py-2 text-xs text-parchment-500">
          Total minutes:{" "}
          <span
            data-testid="modal-total-mins-allowlist-number"
            className="font-mono font-semibold tabular-nums text-parchment-900"
          >
            {totalMins.toLocaleString()}
          </span>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto border border-parchment-300">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-parchment-300 bg-parchment-100 text-xs uppercase tracking-wide text-parchment-500">
              <th className="px-3 py-2">Season</th>
              <th className="px-3 py-2">Club</th>
              <th className="px-3 py-2 text-right">Apps</th>
              <th className="px-3 py-2 text-right">Goals</th>
              <th className="px-3 py-2 text-right">Assists</th>
              <th className="px-3 py-2 text-right">Mins</th>
              <th className="px-3 py-2 text-right">Y</th>
              <th className="px-3 py-2 text-right">R</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-parchment-200">
            {history.map((r) => (
              <tr key={`${r.season}-${r.clubId}`}>
                <td
                  data-testid="modal-history-season-allowlist-number"
                  className="px-3 py-1.5 font-mono tabular-nums text-parchment-700"
                >
                  {r.season + 1}
                </td>
                <td className="px-3 py-1.5">
                  <span data-testid="player-facing" className="text-parchment-900">
                    {r.clubName}
                  </span>
                </td>
                <td
                  data-testid="modal-history-apps-allowlist-number"
                  className="px-3 py-1.5 text-right font-mono tabular-nums"
                >
                  {r.appearances}
                </td>
                <td
                  data-testid="modal-history-goals-allowlist-number"
                  className="px-3 py-1.5 text-right font-mono font-semibold tabular-nums text-moss-700"
                >
                  {r.goals}
                </td>
                <td
                  data-testid="modal-history-assists-allowlist-number"
                  className="px-3 py-1.5 text-right font-mono tabular-nums"
                >
                  {r.assists}
                </td>
                <td
                  data-testid="modal-history-mins-allowlist-number"
                  className="px-3 py-1.5 text-right font-mono tabular-nums text-parchment-500"
                >
                  {r.minutes}
                </td>
                <td
                  data-testid="modal-history-y-allowlist-number"
                  className="px-3 py-1.5 text-right font-mono tabular-nums text-parchment-500"
                >
                  {r.yellowCards}
                </td>
                <td
                  data-testid="modal-history-r-allowlist-number"
                  className="px-3 py-1.5 text-right font-mono tabular-nums text-clay-700"
                >
                  {r.redCards}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatBlock({
  label,
  value,
  allowlist,
  accent,
}: {
  label: string;
  value: number | string;
  allowlist: string;
  accent?: boolean;
}) {
  return (
    <div className="flex flex-col items-center px-3 py-4 text-center">
      <span
        data-testid={`${allowlist}-allowlist-number`}
        className={`font-mono text-4xl font-medium tabular-nums ${
          accent ? "text-moss-700" : "text-parchment-900"
        }`}
      >
        {value}
      </span>
      <span className="mt-1 text-[10px] uppercase tracking-wider text-parchment-500">
        {label}
      </span>
    </div>
  );
}

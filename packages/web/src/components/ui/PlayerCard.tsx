// PlayerCard — a Panini-style illustrated hero card for the player profile.
//
// Trading-card aesthetic done inside the existing Style Guide:
//   - Club-color stripe at top (4px, same token the AppShell already uses)
//   - Pen-and-ink illustration framed in a parchment-700 border
//   - Ink plate below with Newsreader name + sans details
//   - No drop shadow (§3 ban) — hierarchy comes from border weight +
//     background tier.
//
// Art is loaded from `/player-art/{playerId}.webp|png` (useSketchArt
// candidate chain) with a graceful fallback to the folder default.
// When per-player art lands later, drop files in and the UI picks
// them up — no code change.

import { artFamilyFor, useSketchArt } from "../../hooks/useSketchArt";

import type { RenderedClubRef } from "@rpgfc/shared";

interface PlayerCardProps {
  playerId: number;
  playerName: string;
  positionLabel: string;
  archetypeLabel?: string | null;
  nationality: string;
  age: number;
  club: RenderedClubRef | null;
  certaintyLabel: string;
}

export function PlayerCard({
  playerId,
  playerName,
  positionLabel,
  archetypeLabel,
  nationality,
  age,
  club,
  certaintyLabel,
}: PlayerCardProps) {
  const { src, onError } = useSketchArt("player-art", playerId, artFamilyFor(positionLabel));

  // Club-primary drives the top stripe — the same var the AppShell uses
  // for the global 4px chrome. Falls back to moss-500 for free agents.
  const stripeColor = club?.colors.primary ?? "#5C6B33";

  return (
    <figure
      data-testid="player-card"
      className="w-64 flex-none overflow-hidden border border-parchment-700 bg-parchment-50"
    >
      {/* Club-color stripe */}
      <div aria-hidden className="h-1.5" style={{ backgroundColor: stripeColor }} />

      {/* Illustration frame */}
      <div className="relative bg-parchment-100">
        <img
          src={src}
          onError={onError}
          alt=""
          role="presentation"
          className="block aspect-[4/3] w-full object-cover"
          style={{
            // Gentle sepia + contrast to unify the illustration with the
            // parchment palette without hiding the pen-line texture.
            filter: "sepia(0.15) contrast(1.05) saturate(0.85)",
            mixBlendMode: "multiply",
          }}
        />
        {/* Corner age chip — top-right, like a vintage card. */}
        <div className="absolute right-2 top-2 border border-parchment-700 bg-parchment-50 px-2 py-0.5">
          <span
            data-testid={`player-card-age-allowlist-number`}
            className="font-mono text-sm font-medium tabular-nums text-parchment-900"
          >
            {age}
          </span>
        </div>
        {/* Eyebrow — top-left, small, for position tag. */}
        <div className="absolute left-2 top-2 border border-parchment-700 bg-parchment-50 px-2 py-0.5">
          <span className="font-mono text-xs font-medium uppercase tracking-wide text-parchment-900">
            {positionLabel}
          </span>
        </div>
      </div>

      {/* Nameplate */}
      <figcaption className="border-t border-parchment-700 bg-parchment-50 px-3 py-3">
        <div
          data-testid="player-facing"
          className="font-serif text-lg leading-tight text-parchment-900"
        >
          {playerName}
        </div>
        <div className="mt-1 text-xs uppercase tracking-wide text-parchment-500">
          {archetypeLabel ?? positionLabel} · {nationality}
        </div>
        <div className="mt-2 flex items-center justify-between border-t border-parchment-300 pt-2 text-[10px] uppercase tracking-wide text-parchment-500">
          <span data-testid="player-facing">{club?.name ?? "Free agent"}</span>
          <span className="text-parchment-400">{certaintyLabel}</span>
        </div>
      </figcaption>
    </figure>
  );
}

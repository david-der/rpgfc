// PlayerIdentityCard — Style Guide §6.1, §13.4.
//
// The primary list item for squad / roster / search views. Composes a
// header with position + age, a serif name, the identity prose one-liner,
// and the first few badge chips.

import { Link } from "@tanstack/react-router";

import type { WirePlayer } from "@rpgfc/shared";

import { BadgeChip } from "./BadgeChip";

interface PlayerIdentityCardProps {
  player: WirePlayer;
}

export function PlayerIdentityCard({ player }: PlayerIdentityCardProps) {
  return (
    <article className="border border-parchment-300 bg-parchment-100 p-6 transition-colors hover:border-parchment-700">
      <Link
        to="/players/$id"
        params={{ id: String(player.id) }}
        className="block outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-moss-600"
      >
        <header className="flex items-baseline justify-between border-b border-parchment-200 pb-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-parchment-500">
              <span>{player.positionLabel}</span>
              <span className="mx-2">·</span>
              <span data-testid="age-allowlist-number" className="font-mono tabular-nums">
                {player.age}
              </span>
              <span className="ml-1">yrs</span>
            </div>
            <h3 data-testid="player-facing" className="mt-1 font-serif text-xl text-parchment-900">
              {player.name}
            </h3>
          </div>
          <div className="text-xs uppercase tracking-wide text-parchment-500">
            {player.club?.name ?? "Free Agent"}
          </div>
        </header>

        <p
          data-testid="player-facing"
          className="mt-3 font-serif text-base leading-relaxed text-parchment-800"
        >
          {player.prose.identity}
        </p>

        {player.badges.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {player.badges.slice(0, 6).map((b) => (
              <BadgeChip key={b.key} badge={b} />
            ))}
          </div>
        )}
      </Link>
    </article>
  );
}

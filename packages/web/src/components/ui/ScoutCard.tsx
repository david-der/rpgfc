// ScoutCard — Story 03.
//
// Primary list item for /scouts. Composes a header (name + voice
// description), a small region eyebrow, and a TierPill for the trust
// tier. Same weight class as PlayerIdentityCard from Story 01.

import { Link } from "@tanstack/react-router";

import type { ScoutRef } from "@rpgfc/shared";

interface ScoutCardProps {
  scout: ScoutRef;
}

const REGION_LABEL: Record<string, string> = {
  Iberia: "Iberian Peninsula",
  BeneluxFrance: "Benelux & France",
  SouthAmerica: "South America",
  Global: "Global",
};

export function ScoutCard({ scout }: ScoutCardProps) {
  return (
    <article className="border border-parchment-300 bg-parchment-100 p-6 transition-colors hover:border-parchment-700">
      <Link
        to="/scouts/$id"
        params={{ id: String(scout.id) }}
        className="block outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-moss-600"
      >
        <header className="flex items-baseline justify-between border-b border-parchment-200 pb-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-parchment-500">
              {REGION_LABEL[scout.region] ?? scout.region}
            </div>
            <h3 className="mt-1 font-serif text-xl text-parchment-900">{scout.name}</h3>
            <div className="mt-1 text-xs italic text-parchment-500">{scout.voice.description}</div>
          </div>
          {/* Trust pill — matches TierPill's muted variant from FIX-05 by
              hand. Story 03's scout trust is its own enum (ScoutTrustTier),
              so a Story 03-only widening of TierPill would couple the
              component to the trust ramp; the inline span keeps both
              concepts orthogonal. */}
          <span className="inline-flex h-6 items-center border border-moss-500 bg-parchment-50 px-2 font-sans text-xs font-semibold uppercase tracking-wide text-moss-700">
            {scout.trust}
          </span>
        </header>
      </Link>
    </article>
  );
}

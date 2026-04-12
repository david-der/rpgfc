// FixtureCard — Story 06.
//
// One row in /fixtures grouped by matchday. Whole card is a Link to
// /matches/$id when the fixture has been Played, plain text when it's
// still Scheduled. The two club names are player-facing (chrome
// counts as not, but club names show in the player-facing surface
// per Story 03 conventions).

import { Link } from "@tanstack/react-router";

import type { RenderedFixture } from "@rpgfc/shared";

import { ResultPill } from "./ResultPill";

interface FixtureCardProps {
  fixture: RenderedFixture;
}

function Scoreline({ home, away }: { home: number; away: number }) {
  return (
    <span className="inline-flex items-center gap-2 font-mono tabular-nums text-base font-semibold text-parchment-900">
      <span data-testid="match-score-allowlist-number">{home}</span>
      <span className="text-parchment-400">–</span>
      <span data-testid="match-score-allowlist-number">{away}</span>
    </span>
  );
}

function CardBody({ fixture }: FixtureCardProps) {
  return (
    <article className="flex items-center justify-between border border-parchment-300 bg-parchment-100 px-6 py-4 transition-colors hover:border-parchment-700">
      <div className="flex flex-1 items-center gap-4">
        <div className="flex-1 text-right">
          <div data-testid="player-facing" className="font-serif text-base text-parchment-900">
            {fixture.home.name}
          </div>
        </div>
        <div className="w-24 flex-none text-center">
          {fixture.state === "Played" && fixture.home.goals !== null && fixture.away.goals !== null ? (
            <Scoreline home={fixture.home.goals} away={fixture.away.goals} />
          ) : (
            <span className="text-xs uppercase tracking-wide text-parchment-500">vs</span>
          )}
        </div>
        <div className="flex-1 text-left">
          <div data-testid="player-facing" className="font-serif text-base text-parchment-900">
            {fixture.away.name}
          </div>
        </div>
      </div>
      {fixture.userResult && (
        <div className="ml-4 flex-none">
          <ResultPill result={fixture.userResult} />
        </div>
      )}
    </article>
  );
}

export function FixtureCard({ fixture }: FixtureCardProps) {
  if (fixture.state === "Played") {
    return (
      <Link
        to="/matches/$id"
        params={{ id: String(fixture.id) }}
        className="block outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-moss-600"
      >
        <CardBody fixture={fixture} />
      </Link>
    );
  }
  return <CardBody fixture={fixture} />;
}

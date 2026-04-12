// /matches/$id — Story 06 reading destination.
//
// Profile-archetype shape: hero with the two club names and the
// scoreline (allowlisted), an eyebrow with the matchday number
// (allowlisted), a Newsreader prose body of 2-3 paragraphs, and a
// MatchPerformanceList grouped by club below.
//
// The narrative paragraphs are wrapped in a single
// data-testid="player-facing" element so the doctrine scrape sees
// the prose as a single content surface — if a digit ever leaks into
// the prose, the doctrine spec catches it on the next CI run.

import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { MatchPerformanceList } from "../components/ui/MatchPerformanceList";
import { SectionHeader } from "../components/ui/SectionHeader";
import { fetchMatch } from "../lib/api";

export const Route = createFileRoute("/matches/$id")({
  component: MatchReport,
});

function MatchReport() {
  const { id } = Route.useParams();
  const query = useQuery({
    queryKey: ["match", id],
    queryFn: () => fetchMatch(id),
  });

  if (query.isPending) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-10">
        <p className="text-parchment-600">Loading the match…</p>
      </div>
    );
  }
  if (query.isError || !query.data) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-10">
        <p className="text-semantic-error">Could not load this match.</p>
      </div>
    );
  }

  const match = query.data;
  const homeGoals = match.home.goals ?? 0;
  const awayGoals = match.away.goals ?? 0;

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <SectionHeader
        eyebrow={
          <>
            Match Week{" "}
            <span
              data-testid="match-week-allowlist-number"
              className="font-mono tabular-nums text-parchment-700"
            >
              {match.matchday}
            </span>
          </>
        }
        title="Match report"
      />

      {/* Hero: shields + scoreline */}
      <header className="mt-8 grid grid-cols-[1fr_auto_1fr] items-center gap-6 border-b border-parchment-300 pb-8">
        <div className="text-right">
          <div data-testid="player-facing" className="font-serif text-3xl text-parchment-900">
            {match.home.name}
          </div>
        </div>
        <div className="flex items-baseline gap-3 font-mono tabular-nums text-5xl font-semibold text-parchment-900">
          <span data-testid="match-score-allowlist-number">{homeGoals}</span>
          <span className="text-parchment-400">–</span>
          <span data-testid="match-score-allowlist-number">{awayGoals}</span>
        </div>
        <div className="text-left">
          <div data-testid="player-facing" className="font-serif text-3xl text-parchment-900">
            {match.away.name}
          </div>
        </div>
      </header>

      {/* Prose narrative — drop-cap on the lead. */}
      {match.narrative.length > 0 && (
        <article
          data-testid="match-narrative"
          className="mx-auto mt-10 max-w-prose space-y-6 font-serif text-lg leading-relaxed text-parchment-800"
        >
          {match.narrative.map((paragraph, idx) => (
            <p
              key={idx}
              data-testid="player-facing"
              className={
                idx === 0
                  ? "first-letter:float-left first-letter:mr-2 first-letter:font-serif first-letter:text-6xl first-letter:font-semibold first-letter:leading-none first-letter:text-parchment-900"
                  : ""
              }
            >
              {paragraph}
            </p>
          ))}
        </article>
      )}

      {/* Performance list grouped by club */}
      {match.performances.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 text-xs font-medium uppercase tracking-wide text-parchment-500">
            Performances
          </h2>
          <MatchPerformanceList
            homeName={match.home.name}
            awayName={match.away.name}
            homeId={match.home.id}
            awayId={match.away.id}
            performances={match.performances}
          />
        </section>
      )}
    </div>
  );
}

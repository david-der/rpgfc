// /matches/$id — Rich post-match report.
//
// Tabbed reading destination:
//   - Report: prose narrative + team summary totals + standout list
//   - Stats: Opta-style per-player table (both teams)
//   - Players: compact MatchPerformanceList
//
// All numeric stats (goals, xG, passes, etc) are allowlisted facts.
// The qualitative performance tier is the judgement; everything numeric
// describes a concrete event from the causal match ledger.

import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { HeroIllustration } from "../components/ui/HeroIllustration";
import { MatchPerformanceList } from "../components/ui/MatchPerformanceList";
import { MatchStatsTable } from "../components/ui/MatchStatsTable";
import { MatchTeamSummary } from "../components/ui/MatchTeamSummary";
import { MatchTimeline } from "../components/ui/MatchTimeline";
import { TabBar, type TabDefinition } from "../components/ui/TabBar";
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

  const tabs: TabDefinition[] = [
    {
      key: "report",
      label: "Report",
      content: (
        <div className="space-y-8">
          {match.narrative.length > 0 && (
            <article
              data-testid="match-narrative"
              className="mx-auto max-w-prose space-y-6 font-serif text-lg leading-relaxed text-parchment-800"
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
          <MatchTimeline events={match.events} />
          {match.performances.length > 0 && (
            <MatchTeamSummary
              homeName={match.home.name}
              awayName={match.away.name}
              homeId={match.home.id}
              awayId={match.away.id}
              performances={match.performances}
            />
          )}
        </div>
      ),
    },
    {
      key: "stats",
      label: "Stats",
      content:
        match.performances.length > 0 ? (
          <MatchStatsTable
            homeName={match.home.name}
            awayName={match.away.name}
            homeId={match.home.id}
            awayId={match.away.id}
            performances={match.performances}
          />
        ) : (
          <p className="text-sm italic text-parchment-500">No stats available yet.</p>
        ),
    },
    {
      key: "players",
      label: "Players",
      content:
        match.performances.length > 0 ? (
          <MatchPerformanceList
            homeName={match.home.name}
            awayName={match.away.name}
            homeId={match.home.id}
            awayId={match.away.id}
            performances={match.performances}
          />
        ) : (
          <p className="text-sm italic text-parchment-500">No players to show yet.</p>
        ),
    },
  ];

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <HeroIllustration
        folder="match-art"
        artKey={match.id}
        eyebrow={
          <>
            Match Week <span data-testid="match-week-allowlist-number">{match.matchday}</span>
          </>
        }
        title={
          <span className="flex flex-wrap items-baseline gap-x-3">
            <span data-testid="player-facing">{match.home.name}</span>
            <span className="font-mono tabular-nums text-3xl text-parchment-700">
              <span data-testid="match-score-allowlist-number">{homeGoals}</span>
              <span className="mx-2 text-parchment-400">–</span>
              <span data-testid="match-score-allowlist-number">{awayGoals}</span>
            </span>
            <span data-testid="player-facing">{match.away.name}</span>
          </span>
        }
      />

      <div className="mt-8">
        <TabBar tabs={tabs} />
      </div>
    </div>
  );
}

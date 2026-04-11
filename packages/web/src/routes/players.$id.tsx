// /players/$id — the Profile archetype (Style Guide §10.3).
//
// Layout:
//   - 2px club-stripe top edge (driven by --club-stripe CSS variable).
//   - Hero with serif name, one-line identity, BadgeStack.
//   - TabBar: Overview (fully wired) / History / Badges / Relationships /
//     Contract / Reports (all stubbed).

import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { BadgeStack } from "../components/ui/BadgeStack";
import { CertaintyText } from "../components/ui/CertaintyText";
import { KeyNumber } from "../components/ui/KeyNumber";
import { NarrativeBlock } from "../components/ui/NarrativeBlock";
import { TabBar, type TabDefinition } from "../components/ui/TabBar";
import { TierPill } from "../components/ui/TierPill";
import { fetchPlayer } from "../lib/api";

export const Route = createFileRoute("/players/$id")({
  component: PlayerProfile,
});

function ComingSoon({ label }: { label: string }) {
  return (
    <div className="border border-parchment-300 bg-parchment-100 p-6">
      <p className="text-sm italic text-parchment-500">
        The {label} view is not part of Story 01. It lands in a later story.
      </p>
    </div>
  );
}

function PlayerProfile() {
  const { id } = Route.useParams();
  const query = useQuery({
    queryKey: ["player", id],
    queryFn: () => fetchPlayer(id),
  });

  if (query.isPending) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-10">
        <p className="text-parchment-600">Loading profile…</p>
      </main>
    );
  }
  if (query.isError || !query.data) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-10">
        <p className="text-semantic-error">Could not load this player.</p>
        <Link to="/players" className="mt-4 inline-block text-sm text-moss-600 underline">
          Back to the roster
        </Link>
      </main>
    );
  }
  const player = query.data;

  const tabs: TabDefinition[] = [
    {
      key: "overview",
      label: "Overview",
      content: (
        <div className="space-y-8">
          <NarrativeBlock dropCap label="Player identity">
            <p>{player.prose.identity}</p>
            <p className="text-base text-parchment-700">{player.prose.currentForm}</p>
          </NarrativeBlock>

          <section>
            <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-parchment-500">
              Badges
            </h2>
            <BadgeStack badges={player.badges} />
          </section>

          <section>
            <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-parchment-500">
              Facts
            </h2>
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
              <dt className="text-parchment-500">Position</dt>
              <dd data-testid="player-facing" className="text-parchment-900">
                {player.positionLabel}
              </dd>
              <dt className="text-parchment-500">Nationality</dt>
              <dd data-testid="player-facing" className="text-parchment-900">
                {player.nationality}
              </dd>
              <dt className="text-parchment-500">Preferred foot</dt>
              <dd data-testid="player-facing" className="text-parchment-900">
                {player.preferredFoot}
              </dd>
              <dt className="text-parchment-500">Club</dt>
              <dd data-testid="player-facing" className="text-parchment-900">
                {player.club?.name ?? "Free Agent"}
              </dd>
              <dt className="text-parchment-500">Experience</dt>
              <dd data-testid="player-facing" className="text-parchment-900">
                <CertaintyText certainty={player.certainty}>
                  {player.experience.toLowerCase()}
                </CertaintyText>
              </dd>
            </dl>
          </section>
        </div>
      ),
    },
    { key: "history", label: "History", content: <ComingSoon label="history" /> },
    { key: "badges", label: "Badges", content: <ComingSoon label="badges detail" /> },
    {
      key: "relationships",
      label: "Relationships",
      content: <ComingSoon label="relationships" />,
    },
    { key: "contract", label: "Contract", content: <ComingSoon label="contract" /> },
    { key: "reports", label: "Reports", content: <ComingSoon label="reports" /> },
  ];

  return (
    <>
      <div className="h-[2px] bg-club-stripe" aria-hidden />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <Link
          to="/players"
          className="text-xs uppercase tracking-wide text-parchment-500 hover:text-parchment-800"
        >
          ← Roster
        </Link>

        <header className="mt-4 flex items-end justify-between border-b border-parchment-300 pb-6">
          <div>
            <div className="text-xs uppercase tracking-wide text-parchment-500">
              {player.positionLabel} · {player.nationality}
            </div>
            <h1 data-testid="player-facing" className="mt-1 font-serif text-4xl text-parchment-900">
              {player.name}
            </h1>
            <p
              data-testid="player-facing"
              className="mt-3 font-serif text-lg leading-relaxed text-parchment-700"
            >
              {player.prose.identity}
            </p>
          </div>
          <div className="flex items-start gap-6">
            <KeyNumber value={player.age} label="Age" allowlistReason="age" />
            <div className="flex flex-col items-start gap-2">
              <TierPill label={player.experience} tier={player.experience} />
              <span className="text-xs uppercase tracking-wide text-parchment-500">Career</span>
            </div>
          </div>
        </header>

        <section className="mt-8">
          <TabBar tabs={tabs} />
        </section>
      </main>
    </>
  );
}

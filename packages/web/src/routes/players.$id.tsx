// /players/$id — the Profile archetype (Style Guide §10.3).
//
// Layout:
//   - Hero: serif name, identity subtitle, one-line overall CertaintyText,
//     KeyNumber for age, muted TierPill for experience.
//   - TabBar: Overview (Style Guide §10.3 reading surface) / History / Badges /
//     Relationships / Contract / Reports (latter five stubbed for Story 01).
//
// The AppShell (Story 02) owns the 2px club-stripe at the very top of
// every page and the primary navigation, so this route no longer ships
// its own stripe or a manual "← Roster" affordance — the Players entry
// in the primary nav is the way back.
//
// Fix-spec 01 applied (six craft fixes):
//   FIX-01 — Identity prose appears exactly once, as the hero subtitle.
//            The Overview body's drop-cap opens on player.prose.currentForm.
//   FIX-02 — Experience row removed from the Facts list; the hero TierPill
//            is the single expression of ExperienceTier on the page.
//   FIX-03 — KeyNumber now renders the age in JetBrains Mono + tabular-nums.
//   FIX-04 — TabBar labels force Inter regardless of ancestor font stack.
//   FIX-05 — TierPill defaults to the muted (outlined) variant.
//   FIX-06 — Overall CertaintyText sits under the subtitle in the hero.

import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { BadgeStack } from "../components/ui/BadgeStack";
import { CertaintyText } from "../components/ui/CertaintyText";
import { ContractCard } from "../components/ui/ContractCard";
import { KeyNumber } from "../components/ui/KeyNumber";
import { NarrativeBlock } from "../components/ui/NarrativeBlock";
import { ScoutReportCard } from "../components/ui/ScoutReportCard";
import { TabBar, type TabDefinition } from "../components/ui/TabBar";
import { TierPill } from "../components/ui/TierPill";
import { fetchPlayer, fetchPlayerContract, fetchPlayerReports } from "../lib/api";

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
  const reportsQuery = useQuery({
    queryKey: ["player-reports", id],
    queryFn: () => fetchPlayerReports(id),
  });
  const contractQuery = useQuery({
    queryKey: ["player-contract", id],
    queryFn: () => fetchPlayerContract(id),
  });

  if (query.isPending) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-10">
        <p className="text-parchment-600">Loading profile…</p>
      </div>
    );
  }
  if (query.isError || !query.data) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-10">
        <p className="text-semantic-error">Could not load this player.</p>
        {/* No in-page back link — the Players nav entry is the roster link. */}
      </div>
    );
  }
  const player = query.data;

  const tabs: TabDefinition[] = [
    {
      key: "overview",
      label: "Overview",
      content: (
        <div className="space-y-8">
          {/* FIX-01: Overview body opens on currentForm. The identity line
              is already carried by the hero subtitle above — rendering it
              again here made the drop-cap decorate the wrong sentence and
              forced the reader to read the identity twice. */}
          <NarrativeBlock dropCap label="Current form">
            <p>{player.prose.currentForm}</p>
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
            {/* FIX-02: no Experience row — the hero TierPill owns that
                fact. The Facts list is for things the pill doesn't say. */}
            <dl
              data-testid="player-facts"
              className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm"
            >
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
    {
      key: "contract",
      label: "Contract",
      content: (
        <section className="space-y-4">
          {contractQuery.isPending && <p className="text-parchment-600">Loading contract…</p>}
          {contractQuery.isError && (
            <p className="text-semantic-error">Could not load the contract.</p>
          )}
          {contractQuery.data?.contract ? (
            <ContractCard contract={contractQuery.data.contract} />
          ) : contractQuery.isSuccess ? (
            <p className="text-sm italic text-parchment-500">
              No contract on file yet. Sign this player through the transfer market to populate this
              tab.
            </p>
          ) : null}
        </section>
      ),
    },
    {
      key: "reports",
      label: "Reports",
      content: (
        <section className="space-y-4">
          {reportsQuery.isPending && <p className="text-parchment-600">Loading reports…</p>}
          {reportsQuery.isError && (
            <p className="text-semantic-error">Could not load scout reports.</p>
          )}
          {reportsQuery.data?.items.length === 0 && (
            <p className="text-sm italic text-parchment-500">
              No scout reports yet. Send a scout to a Player Focus assignment to start building
              knowledge of this player.
            </p>
          )}
          {reportsQuery.data?.items.map((report) => (
            <ScoutReportCard key={report.id} report={report} />
          ))}
        </section>
      ),
    },
  ];

  // Story 02 §8.4: the club stripe and the "back to roster" affordance
  // both moved up to the AppShell. The page no longer ships its own 2px
  // top stripe (the shell owns that slot), and the Players entry in the
  // primary nav takes over as the way back to the roster.
  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <header className="flex items-end justify-between border-b border-parchment-300 pb-6">
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
          {/* FIX-06: overall certainty announces how confident the
                manager is in the identity they're reading. Sits under the
                subtitle, once per profile, in the Style Guide §2.6
                typography treatment for the tier. */}
          <p
            data-testid="player-certainty"
            className="mt-2 text-xs uppercase tracking-wide text-parchment-500"
          >
            Known <CertaintyText certainty={player.certainty}>{player.certainty}</CertaintyText>
          </p>
        </div>
        <div className="flex items-start gap-6">
          <KeyNumber value={player.age} label="Age" allowlistReason="age" />
          <div className="flex flex-col items-start gap-2">
            {/* FIX-05: TierPill defaults to the muted outlined variant. */}
            <TierPill tier={player.experience} />
            <span className="text-xs uppercase tracking-wide text-parchment-500">Career</span>
          </div>
        </div>
      </header>

      <section className="mt-8">
        <TabBar tabs={tabs} />
      </section>
    </div>
  );
}

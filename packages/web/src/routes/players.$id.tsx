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

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { PromiseMood } from "@rpgfc/shared";

import { BadgeStack } from "../components/ui/BadgeStack";
import { CertaintyText } from "../components/ui/CertaintyText";
import { ContractCard } from "../components/ui/ContractCard";
import { ExtendContractForm } from "../components/ui/ExtendContractForm";
import { FormSparkline } from "../components/ui/FormSparkline";
import { KeyNumber } from "../components/ui/KeyNumber";
import { NarrativeBlock } from "../components/ui/NarrativeBlock";
import { PlayerCard } from "../components/ui/PlayerCard";
import { PromiseMoodChip } from "../components/ui/PromiseMoodChip";
import { ScoutReportCard } from "../components/ui/ScoutReportCard";
import { TabBar, type TabDefinition } from "../components/ui/TabBar";
import { TierPill } from "../components/ui/TierPill";
import {
  addToWatchlist,
  fetchClubFinances,
  fetchPlayer,
  fetchPlayerContract,
  fetchPlayerForm,
  fetchPlayerHistory,
  fetchPlayerReports,
  fetchWatchlist,
  removeFromWatchlist,
} from "../lib/api";

const PLAYER_TABS = [
  "overview",
  "history",
  "badges",
  "relationships",
  "contract",
  "reports",
] as const;
type PlayerTab = (typeof PLAYER_TABS)[number];

export const Route = createFileRoute("/players/$id")({
  component: PlayerProfile,
  validateSearch: (search: Record<string, unknown>): { tab?: PlayerTab } => {
    const raw = search["tab"];
    return typeof raw === "string" && (PLAYER_TABS as readonly string[]).includes(raw)
      ? { tab: raw as PlayerTab }
      : {};
  },
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
  const formQuery = useQuery({
    queryKey: ["player-form", id],
    queryFn: () => fetchPlayerForm(id),
  });
  const meQuery = useQuery({ queryKey: ["club-finances"], queryFn: fetchClubFinances });
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const activeTab: PlayerTab = search.tab ?? "overview";
  const watchlistQuery = useQuery({ queryKey: ["watchlist"], queryFn: fetchWatchlist });

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

          {formQuery.data && formQuery.data.points.length > 0 && (
            <section>
              <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-parchment-500">
                Recent form
              </h2>
              <FormSparkline series={formQuery.data} />
            </section>
          )}

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
    { key: "history", label: "History", content: <HistoryTab playerId={id} /> },
    { key: "badges", label: "Badges", content: <BadgesTab badges={player.badges} /> },
    {
      key: "relationships",
      label: "Relationships",
      content: <ComingSoon label="relationships" />,
    },
    {
      key: "contract",
      label: "Contract",
      content: (
        <section className="space-y-6">
          {contractQuery.isPending && <p className="text-parchment-600">Loading contract…</p>}
          {contractQuery.isError && (
            <p className="text-semantic-error">Could not load the contract.</p>
          )}
          {contractQuery.data?.contract ? (
            <>
              <ContractCard contract={contractQuery.data.contract} />
              {/* Extension form only appears for the user's own
                  players. `meQuery.data.clubId` comes from the finances
                  endpoint, which is scoped by server-side
                  MANAGED_CLUB_ID — so changing the env var now reroutes
                  who this form appears for. */}
              {meQuery.data?.clubId !== undefined &&
                player.club?.id === meQuery.data.clubId && (
                  <ExtendContractForm
                    playerId={player.id}
                    currentRolePromise={contractQuery.data.contract.rolePromise}
                  />
                )}
            </>
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
      <header className="flex items-start gap-8 border-b border-parchment-300 pb-6">
        {/* Panini-style trading card on the left — per-player illustration
            over a club-color stripe. Drops to no stripe for free agents. */}
        <PlayerCard
          playerId={player.id}
          playerName={player.name}
          positionLabel={player.positionLabel}
          nationality={player.nationality}
          age={player.age}
          club={player.club}
          certaintyLabel={player.certainty}
        />

        <div className="min-w-0 flex-1">
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
          {/* Story 05: promise-mood row. Appears only when the player has
              a squad entry (which implies a contract row is reachable).
              The chip itself carries data-testid="player-facing" on the
              prose line, so the doctrine suite scrapes it. */}
          {player.promiseMood && player.promiseMoodLabel && (
            <div className="mt-3" data-testid="player-mood">
              <PromiseMoodChip
                mood={player.promiseMood as PromiseMood}
                label={player.promiseMoodLabel}
              />
            </div>
          )}
        </div>
        <div className="flex flex-none items-start gap-6">
          <KeyNumber value={player.age} label="Age" allowlistReason="age" />
          <div className="flex flex-col items-start gap-2">
            {/* FIX-05: TierPill defaults to the muted outlined variant. */}
            <TierPill tier={player.experience} />
            <span className="text-xs uppercase tracking-wide text-parchment-500">Career</span>
          </div>
        </div>
      </header>

      <RivalActionRow
        playerId={player.id}
        playerClubId={player.club?.id ?? null}
        myClubId={meQuery.data?.clubId}
        watchedIds={
          (watchlistQuery.data?.items ?? []).map((i) => i.player_id)
        }
      />

      <section className="mt-8">
        <TabBar
          tabs={tabs}
          activeKey={activeTab}
          onChange={(key) => {
            void navigate({
              search: key === "overview" ? {} : { tab: key as PlayerTab },
            });
          }}
        />
      </section>
    </div>
  );
}

function RivalActionRow({
  playerId,
  playerClubId,
  myClubId,
  watchedIds,
}: {
  playerId: number;
  playerClubId: number | null;
  myClubId: number | undefined;
  watchedIds: number[];
}) {
  const queryClient = useQueryClient();
  const addMutation = useMutation({
    mutationFn: () => addToWatchlist(playerId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["watchlist"] }),
  });
  const removeMutation = useMutation({
    mutationFn: () => removeFromWatchlist(playerId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["watchlist"] }),
  });

  // Not at any club → free agent (signing path not in the transfer
  // composer). Skip the rival action row entirely.
  if (playerClubId === null) return null;
  // My own player → Contract tab already has the extend form.
  if (myClubId !== undefined && playerClubId === myClubId) return null;

  const isWatched = watchedIds.includes(playerId);
  const err = addMutation.error ?? removeMutation.error;

  return (
    <section className="mt-6 border border-parchment-300 bg-parchment-100 p-4">
      <div className="flex items-center gap-3">
        <Link
          to="/transfers/$playerId"
          params={{ playerId: String(playerId) }}
          className="border border-moss-600 bg-moss-500 px-4 py-2 font-sans text-sm font-semibold uppercase tracking-wide text-parchment-50 hover:bg-moss-600"
        >
          Bid on this player
        </Link>
        {isWatched ? (
          <button
            type="button"
            onClick={() => removeMutation.mutate()}
            disabled={removeMutation.isPending}
            className="border border-parchment-600 px-4 py-2 font-sans text-sm font-semibold uppercase tracking-wide text-parchment-800 hover:bg-parchment-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {removeMutation.isPending ? "Removing…" : "Remove from watchlist"}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => addMutation.mutate()}
            disabled={addMutation.isPending}
            className="border border-parchment-600 px-4 py-2 font-sans text-sm font-semibold uppercase tracking-wide text-parchment-800 hover:bg-parchment-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {addMutation.isPending ? "Adding…" : "Watch"}
          </button>
        )}
        <span className="text-xs italic text-parchment-500">
          Currently at a rival club.
        </span>
      </div>
      {err && <p className="mt-2 text-sm text-semantic-error">{err.message}</p>}
    </section>
  );
}

// ── History tab ──────────────────────────────────────────────────────────

function HistoryTab({ playerId }: { playerId: string }) {
  const query = useQuery({
    queryKey: ["player-history", playerId],
    queryFn: () => fetchPlayerHistory(playerId),
  });
  if (query.isPending) return <p className="text-parchment-600">Loading…</p>;
  if (query.isError) {
    return <p className="text-semantic-error">Could not load the player's history.</p>;
  }
  const seasons = query.data?.seasons ?? [];
  if (seasons.length === 0) {
    return (
      <p className="text-sm italic text-parchment-500">
        No matches played yet. Their story starts this season.
      </p>
    );
  }
  const totalApps = seasons.reduce((s, r) => s + r.appearances, 0);
  const totalGoals = seasons.reduce((s, r) => s + r.goals, 0);
  const totalAssists = seasons.reduce((s, r) => s + r.assists, 0);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline gap-6 border border-parchment-300 bg-parchment-50 p-4">
        <HistoryStat label="Apps" value={totalApps} />
        <HistoryStat label="Goals" value={totalGoals} />
        <HistoryStat label="Assists" value={totalAssists} />
        <HistoryStat label="Seasons" value={seasons.length} />
      </div>
      <div className="overflow-x-auto border border-parchment-300">
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
            {seasons.map((r) => (
              <tr key={`${r.season}-${r.clubId}`} className="hover:bg-parchment-100">
                <td
                  data-testid="history-season-allowlist-number"
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
                  data-testid="history-apps-allowlist-number"
                  className="px-3 py-1.5 text-right font-mono tabular-nums"
                >
                  {r.appearances}
                </td>
                <td
                  data-testid="history-goals-allowlist-number"
                  className="px-3 py-1.5 text-right font-mono font-semibold tabular-nums text-parchment-900"
                >
                  {r.goals}
                </td>
                <td
                  data-testid="history-assists-allowlist-number"
                  className="px-3 py-1.5 text-right font-mono tabular-nums"
                >
                  {r.assists}
                </td>
                <td
                  data-testid="history-mins-allowlist-number"
                  className="px-3 py-1.5 text-right font-mono tabular-nums text-parchment-500"
                >
                  {r.minutes}
                </td>
                <td
                  data-testid="history-y-allowlist-number"
                  className="px-3 py-1.5 text-right font-mono tabular-nums text-parchment-500"
                >
                  {r.yellowCards}
                </td>
                <td
                  data-testid="history-r-allowlist-number"
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

function HistoryStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col items-start">
      <span
        data-testid={`history-total-${label.toLowerCase()}-allowlist-number`}
        className="font-mono text-3xl font-medium tabular-nums text-parchment-900"
      >
        {value}
      </span>
      <span className="text-xs uppercase tracking-wide text-parchment-500">{label}</span>
    </div>
  );
}

// ── Badges tab ───────────────────────────────────────────────────────────

import type { BadgeRef, BadgeCategory } from "@rpgfc/shared";
import { BADGE_CATEGORIES } from "@rpgfc/shared";

function BadgesTab({ badges }: { badges: BadgeRef[] }) {
  if (badges.length === 0) {
    return (
      <p className="text-sm italic text-parchment-500">
        No badges yet. This player is still earning their identity.
      </p>
    );
  }
  const byCategory = new Map<BadgeCategory, BadgeRef[]>();
  for (const cat of BADGE_CATEGORIES) byCategory.set(cat, []);
  for (const b of badges) byCategory.get(b.category)?.push(b);
  return (
    <div className="space-y-6">
      {BADGE_CATEGORIES.map((cat) => {
        const items = byCategory.get(cat) ?? [];
        if (items.length === 0) return null;
        return (
          <section key={cat}>
            <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-parchment-500">
              {cat} <span className="ml-1 text-parchment-400">({items.length})</span>
            </h3>
            <BadgeStack badges={items} />
          </section>
        );
      })}
    </div>
  );
}

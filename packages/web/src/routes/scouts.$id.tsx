// /scouts/$id — Story 03 Profile archetype for a single named scout.
//
// Layout:
//   - Hero with scout name, region eyebrow, voice description, trust pill.
//   - TabBar with Overview / Recent reports / Assignment.
//   - Overview tab carries the AssignmentPicker, the active assignment
//     summary, and a dev-only "Run observation tick" button so the
//     information economy can be exercised by hand until Story 07 wires
//     the seasonal calendar.

import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { AssignmentPicker } from "../components/ui/AssignmentPicker";
import { ScoutReportCard } from "../components/ui/ScoutReportCard";
import { TabBar, type TabDefinition } from "../components/ui/TabBar";
import { fetchScout, startScoutAssignment, tickWorldObservations } from "../lib/api";

export const Route = createFileRoute("/scouts/$id")({
  component: ScoutProfile,
});

const REGION_LABEL: Record<string, string> = {
  Iberia: "Iberian Peninsula",
  BeneluxFrance: "Benelux & France",
  SouthAmerica: "South America",
  Global: "Global",
};

function ScoutProfile() {
  const { id } = Route.useParams();
  const queryClient = useQueryClient();

  const scoutQuery = useQuery({
    queryKey: ["scout", id],
    queryFn: () => fetchScout(id),
  });

  const startMutation = useMutation({
    mutationFn: (params: Parameters<typeof startScoutAssignment>[1]) =>
      startScoutAssignment(id, params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scout", id] });
    },
  });

  const tickMutation = useMutation({
    mutationFn: tickWorldObservations,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scout", id] });
    },
  });

  if (scoutQuery.isPending) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-10">
        <p className="text-parchment-600">Loading scout…</p>
      </div>
    );
  }
  if (scoutQuery.isError || !scoutQuery.data) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-10">
        <p className="text-semantic-error">Could not load this scout.</p>
      </div>
    );
  }

  const { scout, activeAssignment, recentReports } = scoutQuery.data;

  const tabs: TabDefinition[] = [
    {
      key: "overview",
      label: "Overview",
      content: (
        <div className="space-y-8">
          <section>
            <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-parchment-500">
              Active assignment
            </h2>
            {activeAssignment ? (
              <div className="border border-parchment-300 bg-parchment-100 p-6 font-sans text-sm">
                <div className="text-xs uppercase tracking-wide text-parchment-500">
                  {activeAssignment.kind === "region" ? "Regional Watch" : "Player Focus"}
                </div>
                <div className="mt-1 font-serif text-xl text-parchment-900">
                  {activeAssignment.targetRegion ??
                    activeAssignment.targetPlayerName ??
                    "Unknown target"}
                </div>
              </div>
            ) : (
              <p className="text-sm italic text-parchment-500">
                No active assignment. Pick one below.
              </p>
            )}
          </section>

          <section>
            <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-parchment-500">
              New assignment
            </h2>
            <AssignmentPicker
              scoutId={scout.id}
              busy={startMutation.isPending}
              onSubmit={async (params) => {
                await startMutation.mutateAsync(params);
              }}
            />
          </section>

          {/* Dev-only world tick button. The endpoint is gated server-side
              by AUTH_MODE === "dev"; we render the button anyway because
              every Story 03 dev environment satisfies that. */}
          <section>
            <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-parchment-500">
              Dev controls
            </h2>
            <button
              type="button"
              disabled={tickMutation.isPending}
              onClick={() => tickMutation.mutate()}
              className="border border-clay-500 bg-parchment-50 px-4 py-2 font-sans text-sm font-semibold text-clay-700 outline-offset-2 transition-colors hover:bg-clay-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-moss-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {tickMutation.isPending ? "Ticking…" : "Run observation tick"}
            </button>
            {tickMutation.data && (
              <p className="mt-2 text-xs text-parchment-500">
                Wrote {tickMutation.data.observationsWritten} observations and{" "}
                {tickMutation.data.reportsWritten} reports.
              </p>
            )}
          </section>
        </div>
      ),
    },
    {
      key: "reports",
      label: "Recent reports",
      content: (
        <section className="space-y-4">
          {recentReports.length === 0 && (
            <p className="text-sm italic text-parchment-500">
              No reports yet. Start an assignment and run an observation tick to see prose appear
              here.
            </p>
          )}
          {recentReports.map((report) => (
            <ScoutReportCard key={report.id} report={report} />
          ))}
        </section>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <header className="border-b border-parchment-300 pb-6">
        <div className="text-xs uppercase tracking-wide text-parchment-500">
          {REGION_LABEL[scout.region] ?? scout.region}
        </div>
        <h1 className="mt-1 font-serif text-4xl text-parchment-900">{scout.name}</h1>
        <p className="mt-2 text-sm italic text-parchment-500">{scout.voice.description}</p>
        <p className="mt-2 text-xs uppercase tracking-wide text-parchment-500">
          Trust: {scout.trust}
        </p>
      </header>
      <section className="mt-8">
        <TabBar tabs={tabs} />
      </section>
    </div>
  );
}

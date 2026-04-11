// ScoutReportCard — Story 03.
//
// Reading card that wraps a single scout report in editorial typography.
// Per Style Guide §4.4: Newsreader serif body, max-w-prose column, left
// border in --club-secondary, eyebrow with the scout name + assignment
// kind + date.
//
// The body is editorial prose (the scout's voice), wrapped in a
// NarrativeBlock so it inherits the same prose treatment used for
// the player profile's identity paragraph.

import type { ScoutReportRef } from "@rpgfc/shared";

import { NarrativeBlock } from "./NarrativeBlock";

interface ScoutReportCardProps {
  report: ScoutReportRef;
}

const KIND_LABEL: Record<string, string> = {
  region: "Regional watch",
  player: "Player focus",
};

function formatDate(iso: string): string {
  // Show YYYY-MM-DD only — the eyebrow doesn't need a wall clock and the
  // doctrine suite scrapes the prose body, not the date string.
  return iso.slice(0, 10);
}

export function ScoutReportCard({ report }: ScoutReportCardProps) {
  return (
    <article
      className="border-l-[3px] border-club-secondary bg-parchment-100 p-6"
      data-testid="scout-report-card"
    >
      <header className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="text-xs uppercase tracking-wide text-parchment-500">
          {report.scoutName} · {KIND_LABEL[report.assignmentKind] ?? report.assignmentKind}
        </div>
        <div
          data-testid="scout-report-date-allowlist-number"
          className="font-mono text-xs tabular-nums text-parchment-500"
        >
          {formatDate(report.createdAt)}
        </div>
      </header>
      {/* Editorial copy — opted out of player-facing scrape per Story 03
          §3.8. Scout reports may legitimately contain digits like
          "watched him twice this week" without violating the no-numbers
          doctrine; reports are editorial output, not raw player facts. */}
      <NarrativeBlock playerFacing={false}>
        <p>{report.prose}</p>
      </NarrativeBlock>
    </article>
  );
}

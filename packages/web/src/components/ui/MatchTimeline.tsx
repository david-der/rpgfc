import type { RenderedMatchEvent } from "@rpgfc/shared";

export function MatchTimeline({ events }: { events: RenderedMatchEvent[] }) {
  if (events.length === 0) return null;
  return (
    <section className="border border-parchment-300 bg-parchment-100 p-6">
      <h2 className="text-xs font-medium uppercase tracking-wide text-parchment-500">
        Key moments
      </h2>
      <ol className="mt-4 divide-y divide-parchment-200">
        {events.map((event) => (
          <li key={event.sequence} className="grid grid-cols-[3rem_1fr_auto] gap-3 py-3">
            <span
              data-testid="match-minute-allowlist-number"
              className="font-mono text-sm tabular-nums text-parchment-600"
            >
              {event.minute}&prime;
            </span>
            <span data-testid="player-facing" className="font-serif text-sm text-parchment-800">
              {event.description}
            </span>
            <span className="text-[10px] uppercase tracking-wide text-parchment-500">
              {event.kind}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

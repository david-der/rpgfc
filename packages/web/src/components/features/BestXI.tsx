// Best XI of the season — drawn as an actual formation on a pitch.
// GK at the back (top), 3 DEF across, 4 MID across, 3 FWD across the
// front. Role is implicit from position on the pitch; each card leads
// with qualitative evidence from the player's season instead of a rating.

import { usePlayerModal } from "../PlayerModalProvider";

interface BestXIEntry {
  player_id: number;
  player_name: string;
  club_name: string;
  role: string;
  appearances: number;
  goals: number;
  assists: number;
  evidence: string[];
}

interface BestXIProps {
  bestXI: {
    gk: BestXIEntry | null;
    def: BestXIEntry[];
    mid: BestXIEntry[];
    fwd: BestXIEntry[];
  };
}

export function BestXISection(props: BestXIProps) {
  const { bestXI } = props;
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-parchment-500">
        Best XI of the season
      </h2>
      <Pitch>
        <Line>
          {bestXI.fwd.map((e, i) => (
            <Slot key={e.player_id} entry={e} slot="fwd" idx={i} />
          ))}
        </Line>
        <Line>
          {bestXI.mid.map((e, i) => (
            <Slot key={e.player_id} entry={e} slot="mid" idx={i} />
          ))}
        </Line>
        <Line>
          {bestXI.def.map((e, i) => (
            <Slot key={e.player_id} entry={e} slot="def" idx={i} />
          ))}
        </Line>
        {bestXI.gk && (
          <Line>
            <Slot entry={bestXI.gk} slot="gk" idx={0} />
          </Line>
        )}
      </Pitch>
    </section>
  );
}

// The pitch is a muted parchment panel with faint horizontal lines
// between formation rows. Style-guide-safe: 1px borders, 0 radius,
// 0 shadow, parchment palette only.
function Pitch({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative border border-parchment-300 bg-[repeating-linear-gradient(180deg,theme(colors.parchment.100)_0px,theme(colors.parchment.100)_24px,theme(colors.parchment.50)_24px,theme(colors.parchment.50)_48px)] px-4 py-6">
      <div className="relative flex flex-col gap-5">{children}</div>
    </div>
  );
}

function Line({ children }: { children: React.ReactNode }) {
  return <div className="flex items-stretch justify-around gap-3">{children}</div>;
}

function Slot({ entry, slot, idx }: { entry: BestXIEntry; slot: string; idx: number }) {
  const modal = usePlayerModal();
  return (
    <button
      type="button"
      onClick={() => modal.open(entry.player_id)}
      className="flex min-w-[9rem] max-w-[12rem] flex-1 flex-col items-center border border-parchment-300 bg-parchment-50 px-3 py-3 text-center hover:bg-parchment-100"
    >
      <span className="font-serif text-base leading-tight text-parchment-900">
        <span data-testid="player-facing">{entry.player_name}</span>
      </span>
      <span
        data-testid="player-facing"
        className="mt-1 text-[11px] font-medium uppercase tracking-wide text-parchment-600"
      >
        {entry.club_name}
      </span>
      <span
        data-testid="player-facing"
        className="mt-2 font-serif text-sm leading-snug text-parchment-700"
      >
        {entry.evidence[0] ?? "Trusted throughout the campaign"}
      </span>
      <span className="mt-2 flex items-baseline justify-center gap-2 font-mono text-[11px] tabular-nums text-parchment-600">
        <span>
          <span data-testid={`bestxi-${slot}-${idx}-apps-allowlist-number`}>
            {entry.appearances}
          </span>
          <span className="ml-0.5 text-parchment-500">apps</span>
        </span>
        <span>
          <span data-testid={`bestxi-${slot}-${idx}-goals-allowlist-number`}>{entry.goals}</span>
          <span className="ml-0.5 text-parchment-500">G</span>
        </span>
        <span>
          <span data-testid={`bestxi-${slot}-${idx}-assists-allowlist-number`}>
            {entry.assists}
          </span>
          <span className="ml-0.5 text-parchment-500">A</span>
        </span>
      </span>
    </button>
  );
}

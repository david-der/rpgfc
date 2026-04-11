// AssignmentPicker — Story 03.
//
// Editor-archetype panel for starting a new scout assignment. Story 03
// keeps it minimal: a kind selector (Region or Player), a target field,
// and a Start button. The submit handler posts via the typed RPC client.
//
// Visual: Card-style container, no radius, no shadow, Inter labels.

import { useState } from "react";

import type { ScoutRegion } from "@rpgfc/shared";
import { SCOUT_REGIONS } from "@rpgfc/shared";

interface AssignmentPickerProps {
  scoutId: number;
  onSubmit: (params: {
    kind: "region" | "player";
    targetRegion?: ScoutRegion;
    targetPlayerId?: number;
  }) => void | Promise<void>;
  busy?: boolean;
}

export function AssignmentPicker({ scoutId, onSubmit, busy }: AssignmentPickerProps) {
  const [kind, setKind] = useState<"region" | "player">("region");
  const [region, setRegion] = useState<ScoutRegion>("Iberia");
  const [playerId, setPlayerId] = useState<string>("1");

  const canSubmit = !busy && (kind === "region" ? region : playerId.length > 0);

  return (
    <form
      className="border border-parchment-300 bg-parchment-100 p-6"
      data-testid="assignment-picker"
      onSubmit={(e) => {
        e.preventDefault();
        if (kind === "region") {
          void onSubmit({ kind, targetRegion: region });
        } else {
          const id = Number(playerId);
          if (Number.isFinite(id) && id > 0) {
            void onSubmit({ kind, targetPlayerId: id });
          }
        }
      }}
    >
      <div className="text-xs uppercase tracking-wide text-parchment-500">New assignment</div>
      <div className="mt-1 font-serif text-xl text-parchment-900">
        Where should scout #{scoutId} go next?
      </div>

      <fieldset className="mt-4 flex gap-6 font-sans text-sm">
        <legend className="sr-only">Assignment kind</legend>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="kind"
            value="region"
            checked={kind === "region"}
            onChange={() => setKind("region")}
          />
          Regional Watch
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="kind"
            value="player"
            checked={kind === "player"}
            onChange={() => setKind("player")}
          />
          Player Focus
        </label>
      </fieldset>

      {kind === "region" ? (
        <label className="mt-4 block font-sans text-sm">
          <div className="text-xs uppercase tracking-wide text-parchment-500">Region</div>
          <select
            className="mt-1 border border-parchment-400 bg-parchment-50 px-2 py-1 font-sans text-sm text-parchment-900"
            value={region}
            onChange={(e) => setRegion(e.target.value as ScoutRegion)}
          >
            {SCOUT_REGIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <label className="mt-4 block font-sans text-sm">
          <div className="text-xs uppercase tracking-wide text-parchment-500">Player id</div>
          <input
            type="number"
            min="1"
            value={playerId}
            onChange={(e) => setPlayerId(e.target.value)}
            className="mt-1 w-32 border border-parchment-400 bg-parchment-50 px-2 py-1 font-mono text-sm tabular-nums text-parchment-900"
          />
        </label>
      )}

      <div className="mt-6 flex items-center gap-3">
        <button
          type="submit"
          disabled={!canSubmit}
          className="border border-moss-500 bg-moss-500 px-4 py-2 font-sans text-sm font-semibold text-parchment-50 outline-offset-2 transition-colors hover:bg-moss-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-moss-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? "Starting…" : "Start"}
        </button>
      </div>
    </form>
  );
}

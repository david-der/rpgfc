// ExtendContractForm — Finance v2.
//
// Offer a renewal to a player already at your club. Tier-word inputs
// for wage + signing bonus, role promise select, seasons slider.
// Player evaluator decides accept/reject.

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import type { CurrencyTier, PlayingTimeRole } from "@rpgfc/shared";
import { CURRENCY_TIERS, PLAYING_TIME_ROLES } from "@rpgfc/shared";

import { extendContract } from "../../lib/api";

interface ExtendContractFormProps {
  playerId: number;
  currentRolePromise?: PlayingTimeRole;
}

export function ExtendContractForm({ playerId, currentRolePromise }: ExtendContractFormProps) {
  const queryClient = useQueryClient();
  const [wageTier, setWageTier] = useState<CurrencyTier>("Modest");
  const [signingBonusTier, setSigningBonusTier] = useState<CurrencyTier>("Minimal");
  const [seasons, setSeasons] = useState(3);
  const [rolePromise, setRolePromise] = useState<PlayingTimeRole>(
    currentRolePromise ?? "Important Player",
  );
  const [resultMsg, setResultMsg] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: extendContract,
    onSuccess: () => {
      setResultMsg("Extension agreed.");
      queryClient.invalidateQueries({ queryKey: ["player-contract", String(playerId)] });
      queryClient.invalidateQueries({ queryKey: ["club-finances"] });
      queryClient.invalidateQueries({ queryKey: ["club-ledger"] });
    },
    onError: (err: Error) => {
      setResultMsg(`The player rejected the offer: ${err.message}`);
    },
  });

  return (
    <div className="border border-parchment-300 bg-parchment-50 p-6">
      <h3 className="text-xs font-medium uppercase tracking-wide text-parchment-500">
        Extend contract
      </h3>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <TierField label="Weekly wage" value={wageTier} onChange={setWageTier} />
        <TierField label="Signing bonus" value={signingBonusTier} onChange={setSigningBonusTier} />
        <label>
          <div className="text-xs uppercase tracking-wide text-parchment-500">Seasons</div>
          <select
            value={seasons}
            onChange={(e) => setSeasons(Number(e.target.value))}
            className="mt-1 w-full border border-parchment-400 bg-parchment-50 px-2 py-1 font-sans text-sm text-parchment-900"
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n} season{n !== 1 ? "s" : ""}
              </option>
            ))}
          </select>
        </label>
        <label>
          <div className="text-xs uppercase tracking-wide text-parchment-500">Role promise</div>
          <select
            value={rolePromise}
            onChange={(e) => setRolePromise(e.target.value as PlayingTimeRole)}
            className="mt-1 w-full border border-parchment-400 bg-parchment-50 px-2 py-1 font-sans text-sm text-parchment-900"
          >
            {PLAYING_TIME_ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() =>
            mutation.mutate({
              playerId,
              wageTier,
              signingBonusTier,
              seasons,
              rolePromise,
            })
          }
          disabled={mutation.isPending}
          className="border border-moss-600 bg-moss-500 px-4 py-2 font-sans text-sm font-semibold uppercase tracking-wide text-parchment-50 hover:bg-moss-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {mutation.isPending ? "Offering…" : "Offer extension"}
        </button>
        {resultMsg && (
          <span
            className={`text-sm ${
              mutation.isSuccess ? "text-moss-700" : "text-clay-700"
            }`}
          >
            {resultMsg}
          </span>
        )}
      </div>
    </div>
  );
}

function TierField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: CurrencyTier;
  onChange: (v: CurrencyTier) => void;
}) {
  return (
    <label>
      <div className="text-xs uppercase tracking-wide text-parchment-500">{label}</div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as CurrencyTier)}
        className="mt-1 w-full border border-parchment-400 bg-parchment-50 px-2 py-1 font-sans text-sm text-parchment-900"
      >
        {CURRENCY_TIERS.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
    </label>
  );
}

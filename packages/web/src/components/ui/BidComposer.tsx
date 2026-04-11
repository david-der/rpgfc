// BidComposer — Story 04 Editor archetype form.
//
// The user never types cents. They pick tier words for fee and wage,
// pick a playing-time role promise, toggle loan/permanent, and submit.
// The server maps the tier words to midpoint cents via the currency
// thesaurus.
//
// Visual shape per Style Guide §10.4 (Editor archetype): Configuration
// panel on the right, persistent action bar at the bottom. Story 04
// keeps the form inline in a Card so the Profile preview and the form
// can live side-by-side on a single page.

import { useState } from "react";

import type { CurrencyTier, PlayingTimeRole } from "@rpgfc/shared";
import { CURRENCY_TIERS, PLAYING_TIME_ROLES } from "@rpgfc/shared";

export interface BidComposerValue {
  feeTier: CurrencyTier;
  wageTier: CurrencyTier;
  signingBonusTier: CurrencyTier;
  rolePromise: PlayingTimeRole;
  isLoan: boolean;
}

interface BidComposerProps {
  initialAskingTier?: CurrencyTier;
  onSubmit: (value: BidComposerValue) => void | Promise<void>;
  busy?: boolean;
}

export function BidComposer({ initialAskingTier = "Notable", onSubmit, busy }: BidComposerProps) {
  const [feeTier, setFeeTier] = useState<CurrencyTier>(initialAskingTier);
  const [wageTier, setWageTier] = useState<CurrencyTier>("Modest");
  const [signingBonusTier, setSigningBonusTier] = useState<CurrencyTier>("Minimal");
  const [rolePromise, setRolePromise] = useState<PlayingTimeRole>("Important Player");
  const [isLoan, setIsLoan] = useState(false);

  const canSubmit = !busy;

  return (
    <form
      data-testid="bid-composer"
      className="border border-parchment-300 bg-parchment-100 p-6"
      onSubmit={(e) => {
        e.preventDefault();
        void onSubmit({ feeTier, wageTier, signingBonusTier, rolePromise, isLoan });
      }}
    >
      <div className="text-xs uppercase tracking-wide text-parchment-500">New bid</div>
      <div className="mt-1 font-serif text-xl text-parchment-900">Compose an offer</div>

      <div className="mt-6 grid grid-cols-2 gap-4 font-sans text-sm">
        <TierSelect label="Fee" value={feeTier} onChange={setFeeTier} testId="bid-fee-select" />
        <TierSelect
          label="Weekly wage"
          value={wageTier}
          onChange={setWageTier}
          testId="bid-wage-select"
        />
        <TierSelect
          label="Signing bonus"
          value={signingBonusTier}
          onChange={setSigningBonusTier}
          testId="bid-bonus-select"
        />
        <label className="block">
          <div className="text-xs uppercase tracking-wide text-parchment-500">Role promise</div>
          <select
            data-testid="bid-role-select"
            className="mt-1 w-full border border-parchment-400 bg-parchment-50 px-2 py-1 font-sans text-sm text-parchment-900"
            value={rolePromise}
            onChange={(e) => setRolePromise(e.target.value as PlayingTimeRole)}
          >
            {PLAYING_TIME_ROLES.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        </label>
      </div>

      <fieldset className="mt-6 flex gap-6 font-sans text-sm">
        <legend className="sr-only">Transfer kind</legend>
        <label className="flex items-center gap-2">
          <input type="radio" name="bid-kind" checked={!isLoan} onChange={() => setIsLoan(false)} />
          Permanent
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" name="bid-kind" checked={isLoan} onChange={() => setIsLoan(true)} />
          Loan
        </label>
      </fieldset>

      <div className="mt-8 flex items-center gap-3">
        <button
          type="submit"
          disabled={!canSubmit}
          className="border border-moss-500 bg-moss-500 px-4 py-2 font-sans text-sm font-semibold text-parchment-50 outline-offset-2 transition-colors hover:bg-moss-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-moss-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? "Submitting…" : "Submit offer"}
        </button>
      </div>
    </form>
  );
}

interface TierSelectProps {
  label: string;
  value: CurrencyTier;
  onChange: (v: CurrencyTier) => void;
  testId: string;
}

function TierSelect({ label, value, onChange, testId }: TierSelectProps) {
  return (
    <label className="block">
      <div className="text-xs uppercase tracking-wide text-parchment-500">{label}</div>
      <select
        data-testid={testId}
        className="mt-1 w-full border border-parchment-400 bg-parchment-50 px-2 py-1 font-sans text-sm text-parchment-900"
        value={value}
        onChange={(e) => onChange(e.target.value as CurrencyTier)}
      >
        {CURRENCY_TIERS.map((tier) => (
          <option key={tier} value={tier}>
            {tier}
          </option>
        ))}
      </select>
    </label>
  );
}

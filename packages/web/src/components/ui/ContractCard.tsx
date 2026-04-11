// ContractCard — Story 04 reading card for the player profile's
// Contract tab.
//
// Renders qualitative wage/bonus tiers and a plain integer for
// seasonsRemaining (the single allowlisted numeric surface on the
// Contract tab — documented by the data-testid suffix).

import type { RenderedContract } from "@rpgfc/shared";

interface ContractCardProps {
  contract: RenderedContract;
}

export function ContractCard({ contract }: ContractCardProps) {
  return (
    <article className="border border-parchment-300 bg-parchment-100 p-6">
      <header className="flex items-baseline justify-between border-b border-parchment-200 pb-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-parchment-500">
            {contract.isLoan ? "Loan contract" : "Permanent contract"}
          </div>
          <h3 data-testid="player-facing" className="mt-1 font-serif text-xl text-parchment-900">
            {contract.club.name}
          </h3>
        </div>
        <div data-testid="seasons-remaining-allowlist-number" className="flex flex-col items-end">
          <span className="font-mono text-4xl font-medium tabular-nums text-parchment-900">
            {contract.seasonsRemaining}
          </span>
          <span className="text-xs uppercase tracking-wide text-parchment-500">Seasons left</span>
        </div>
      </header>

      <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
        <dt className="text-parchment-500">Weekly wage</dt>
        <dd data-testid="player-facing" className="text-parchment-900">
          {contract.wageTier}
        </dd>
        <dt className="text-parchment-500">Signing bonus</dt>
        <dd data-testid="player-facing" className="text-parchment-900">
          {contract.signingBonusTier}
        </dd>
        <dt className="text-parchment-500">Role promise</dt>
        <dd data-testid="player-facing" className="text-parchment-900">
          {contract.rolePromise}
        </dd>
        {contract.hasReleaseClause && contract.releaseClauseTier && (
          <>
            <dt className="text-parchment-500">Release clause</dt>
            <dd data-testid="player-facing" className="text-parchment-900">
              {contract.releaseClauseTier}
            </dd>
          </>
        )}
        {contract.isLoan && contract.loanWageCoverageLabel && (
          <>
            <dt className="text-parchment-500">Loan coverage</dt>
            <dd data-testid="player-facing" className="text-parchment-900">
              {contract.loanWageCoverageLabel}
            </dd>
          </>
        )}
      </dl>
    </article>
  );
}

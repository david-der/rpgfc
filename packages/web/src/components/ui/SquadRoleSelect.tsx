// SquadRoleSelect — Story 05.
//
// Native <select> styled to match the BidComposer's role picker. The
// four SquadRole values are narrower than the five PlayingTimeRole
// values so this is a distinct component from the transfers picker
// (Story 04) rather than a reused one.

import type { SquadRole } from "@rpgfc/shared";
import { SQUAD_ROLES } from "@rpgfc/shared";

interface SquadRoleSelectProps {
  value: SquadRole;
  onChange: (value: SquadRole) => void;
  disabled?: boolean;
  testId?: string;
}

export function SquadRoleSelect({ value, onChange, disabled, testId }: SquadRoleSelectProps) {
  return (
    <select
      data-testid={testId}
      disabled={disabled}
      className="border border-parchment-400 bg-parchment-50 px-2 py-1 font-sans text-sm text-parchment-900 disabled:cursor-not-allowed disabled:opacity-60"
      value={value}
      onChange={(e) => onChange(e.target.value as SquadRole)}
    >
      {SQUAD_ROLES.map((role) => (
        <option key={role} value={role}>
          {role}
        </option>
      ))}
    </select>
  );
}

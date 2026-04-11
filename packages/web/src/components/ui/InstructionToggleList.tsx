// InstructionToggleList — Story 05 /tactics right-config atom.
//
// One toggle chip per TeamInstruction. Chips are plain <button>s with
// aria-pressed so assistive tech reads them as toggles. Zero radius,
// no shadow — a border + background change carries the state.

import type { TeamInstruction } from "@rpgfc/shared";
import { TEAM_INSTRUCTIONS, TEAM_INSTRUCTION_LABELS } from "@rpgfc/shared";

interface InstructionToggleListProps {
  value: TeamInstruction[];
  onChange: (value: TeamInstruction[]) => void;
  disabled?: boolean;
}

export function InstructionToggleList({
  value,
  onChange,
  disabled,
}: InstructionToggleListProps) {
  const selected = new Set(value);

  function toggle(instruction: TeamInstruction) {
    const next = new Set(selected);
    if (next.has(instruction)) {
      next.delete(instruction);
    } else {
      next.add(instruction);
    }
    onChange(TEAM_INSTRUCTIONS.filter((i) => next.has(i)));
  }

  return (
    <div className="flex flex-wrap gap-2">
      {TEAM_INSTRUCTIONS.map((instruction) => {
        const isOn = selected.has(instruction);
        return (
          <button
            key={instruction}
            type="button"
            aria-pressed={isOn}
            disabled={disabled}
            onClick={() => toggle(instruction)}
            className={
              isOn
                ? "border border-moss-600 bg-moss-500 px-3 py-1 font-sans text-xs font-semibold uppercase tracking-wide text-parchment-50"
                : "border border-parchment-400 bg-parchment-50 px-3 py-1 font-sans text-xs font-medium uppercase tracking-wide text-parchment-700 hover:border-parchment-700"
            }
          >
            {TEAM_INSTRUCTION_LABELS[instruction]}
          </button>
        );
      })}
    </div>
  );
}

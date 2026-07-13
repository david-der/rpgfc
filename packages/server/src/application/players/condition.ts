import type { SimPlayerUpdate } from "../../sim/interface.js";

export const WEEKLY_RECOVERY = 18;
export const YELLOW_CARD_SUSPENSION_THRESHOLD = 5;

export interface ConditionState {
  fatigueLoad: number;
  injuryMatchesRemaining: number;
  injuryKind: string | null;
}

export interface DisciplineState {
  yellowCards: number;
  suspensionMatchesRemaining: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function recoverCondition(state: ConditionState): ConditionState {
  const injuryMatchesRemaining = Math.max(0, state.injuryMatchesRemaining - 1);
  return {
    fatigueLoad: Math.max(0, state.fatigueLoad - WEEKLY_RECOVERY),
    injuryMatchesRemaining,
    injuryKind: injuryMatchesRemaining > 0 ? state.injuryKind : null,
  };
}

export function applyMatchLoad(recovered: ConditionState, update: SimPlayerUpdate): ConditionState {
  const injuryMatchesRemaining = Math.max(recovered.injuryMatchesRemaining, update.injuryMatches);
  return {
    fatigueLoad: clamp(recovered.fatigueLoad + update.fatigueDelta, 0, 100),
    injuryMatchesRemaining,
    injuryKind: injuryMatchesRemaining > 0 ? (recovered.injuryKind ?? "match_injury") : null,
  };
}

export function serveSuspension(state: DisciplineState): DisciplineState {
  return {
    ...state,
    suspensionMatchesRemaining: Math.max(0, state.suspensionMatchesRemaining - 1),
  };
}

export function applyDiscipline(served: DisciplineState, update: SimPlayerUpdate): DisciplineState {
  const totalYellows = served.yellowCards + update.yellowCards;
  const thresholdReached = totalYellows >= YELLOW_CARD_SUSPENSION_THRESHOLD;
  return {
    yellowCards: thresholdReached ? 0 : totalYellows,
    suspensionMatchesRemaining: Math.max(
      served.suspensionMatchesRemaining,
      update.redCard || thresholdReached ? 1 : 0,
    ),
  };
}

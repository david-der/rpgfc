export const CONDITION_TIERS = ["Fresh", "Ready", "Heavy", "Spent"] as const;
export type ConditionTier = (typeof CONDITION_TIERS)[number];

export const AVAILABILITY_STATES = ["Available", "Injured", "Suspended"] as const;
export type AvailabilityState = (typeof AVAILABILITY_STATES)[number];

export interface RenderedAvailability {
  state: AvailabilityState;
  condition: ConditionTier;
  explanation: string;
}

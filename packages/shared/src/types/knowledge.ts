// Knowledge graph — Story 03.
//
// The single source of truth for "what does the manager know about what"
// per the PRD's Pillar Four (information has cost) and TDD v2 §18.3
// (knowledge graph sits between the Player entity and the UI rendering).
//
// Each row is an observation: a specific scout (or implicit event) learned
// a specific fact about a specific subject at a specific time with a
// specific certainty tier. The rendering layer reads this graph to decide
// how confident the UI is in every piece of information it displays.
//
// Story 03 seeds only player-subject facts of four kinds (gifts, traits,
// badge presence, club membership). Later stories widen the union.

import type { CertaintyTier } from "./certainty.js";

export const FACT_TYPES = [
  "natural_gift_tier",
  "mental_trait_tier",
  "badge_presence",
  "club_membership",
] as const;

export type FactType = (typeof FACT_TYPES)[number];

export type SubjectKind = "player" | "club";

export interface KnowledgeNodeRef {
  id: number;
  runId: number;
  subjectKind: SubjectKind;
  subjectId: number;
  factType: FactType;
  /** e.g. "pace", "clutch_finisher", "current_club". */
  factKey: string;
  /** Tier word, badge key, or club id as a string. */
  factValueTier: string;
  certainty: CertaintyTier;
  observedAt: string;
  sourceScoutId: number | null;
}

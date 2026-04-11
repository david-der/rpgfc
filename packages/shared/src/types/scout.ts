// Scout shapes — Story 03.
//
// Named scout characters that produce observations over time. Each scout
// has a region of expertise, a voice template, and a trust tier (PRD §7.2).
// The full stack — scout entity, assignments, observations, reports —
// together replaces the synthetic `viewerScoutLevel` integer from Story 01.

export const SCOUT_REGIONS = [
  "Iberia",
  "BeneluxFrance",
  "SouthAmerica",
  "Global",
] as const;

export type ScoutRegion = (typeof SCOUT_REGIONS)[number];

export type ScoutVoiceId = "dry_precise" | "warm_effusive" | "terse_cautious";

export const SCOUT_VOICE_IDS: readonly ScoutVoiceId[] = [
  "dry_precise",
  "warm_effusive",
  "terse_cautious",
] as const;

export interface ScoutVoice {
  id: ScoutVoiceId;
  /** Short devlog-style description ("dry and precise"). */
  description: string;
}

export const SCOUT_TRUST_TIERS = ["New", "Trusted", "Veteran"] as const;
export type ScoutTrustTier = (typeof SCOUT_TRUST_TIERS)[number];

// ── wire shape ─────────────────────────────────────────────────────────────

export interface ScoutRef {
  id: number;
  runId: number;
  name: string;
  region: ScoutRegion;
  voice: ScoutVoice;
  trust: ScoutTrustTier;
}

// ── reports ────────────────────────────────────────────────────────────────

export type AssignmentKind = "region" | "player";

export interface ScoutReportRef {
  id: number;
  scoutId: number;
  scoutName: string;
  voiceId: ScoutVoiceId;
  playerId: number;
  playerName: string;
  assignmentKind: AssignmentKind;
  /** Short prose paragraph rendered in a NarrativeBlock. */
  prose: string;
  /** ISO-8601 timestamp of the tick that produced the report. */
  createdAt: string;
}

export interface AssignmentRef {
  id: number;
  scoutId: number;
  kind: AssignmentKind;
  targetRegion: ScoutRegion | null;
  targetPlayerId: number | null;
  targetPlayerName: string | null;
  startedAt: string;
  endedAt: string | null;
}

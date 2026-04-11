import type { MentalTraits, NaturalGifts, PreferredFoot } from "./attributes.js";
import type { BadgeRef } from "./badge.js";
import type { CertaintyTier } from "./certainty.js";
import type { PlayingTimeRole } from "./contract.js";
import type { ExperienceTier } from "./experience.js";
import type { ScoutReportRef } from "./scout.js";
import type { PromiseMood, SquadRole } from "./squad.js";

// ─────────────────────────────────────────────────────────────────────────────
//  THE RENDERING BOUNDARY (TDD v2 §6)
// ─────────────────────────────────────────────────────────────────────────────
//
// HiddenPlayer carries the raw numeric vector the simulator consumes.
// It lives in this package so the server's rendering/ module can import it,
// BUT it is not re-exported from the public barrel (src/index.ts). The web
// package cannot reach it at all — the ESLint `no-restricted-imports` rule
// and the web-side stricter tsconfig prevent it.
//
// RenderedPlayer is the only player shape permitted to cross the HTTP wire.
// The brand makes the two types nominally distinct at compile time, so that
// accidentally returning a HiddenPlayer from a Hono handler is a type error.

declare const HIDDEN_BRAND: unique symbol;
declare const RENDERED_BRAND: unique symbol;

export interface NarrativeSeed {
  hometown: string;
  story: string;
}

export interface HiddenPlayer {
  readonly [HIDDEN_BRAND]: never;
  id: number;
  runId: number;
  clubId: number | null;
  name: string;
  dob: string; // ISO-8601 date string (portable across SQLite + Postgres)
  nationality: string;
  preferredFoot: PreferredFoot;
  archetypeId: string;
  hiddenAttrs: NaturalGifts;
  mentalTraits: MentalTraits;
  /** Stable string keys from the badge library (e.g. "clutch_finisher"). */
  badgeKeys: string[];
  experienceYears: number;
  narrativeSeed: NarrativeSeed;
}

export const REPUTATION_TIERS = ["Local", "Regional", "National", "Continental", "Elite"] as const;
export type ReputationTier = (typeof REPUTATION_TIERS)[number];

export interface ClubColors {
  primary: string;
  secondary: string;
  stripe: string;
  primaryInk: string;
  secondaryInk: string;
}

export interface RenderedClubRef {
  id: number;
  name: string;
  nationality: string;
  reputation: ReputationTier;
  colors: ClubColors;
}

// ─────────────────────────────────────────────────────────────────────────────
// WirePlayer is the structural, non-branded shape that crosses the HTTP wire.
// JSON serialization strips the brand, so client-side consumers need a type
// they can hand to React components without TypeScript complaining about a
// missing unique-symbol property. The web package uses WirePlayer everywhere.
// ─────────────────────────────────────────────────────────────────────────────

export interface WirePlayer {
  id: number;
  name: string;
  /** Computed from dob at render time. Ages are ALLOWLISTED numerics. */
  age: number;
  nationality: string;
  preferredFoot: PreferredFoot;
  /** Short position label derived from the archetype (e.g. "ST", "CB"). */
  positionLabel: string;
  club: RenderedClubRef | null;
  badges: BadgeRef[];
  prose: {
    identity: string;
    currentForm: string;
  };
  /** How confidently the current viewer knows this player overall. */
  certainty: CertaintyTier;
  experience: ExperienceTier;
  /** Story 03: recent scout reports about this player. May be empty or
   *  absent when the list endpoint wants to save bytes; the profile
   *  endpoint always populates it. The explicit `| undefined` matches
   *  tsconfig's exactOptionalPropertyTypes. */
  scoutReports?: ScoutReportRef[] | undefined;
  /** Story 05: the player's current squad role + contract role promise
   *  + the qualitative mood that results from comparing the two.
   *  Populated by the rendering layer when a SquadEntry exists for the
   *  player. Never a number — the mood label is a short prose line. */
  squadRole?: SquadRole | undefined;
  rolePromise?: PlayingTimeRole | undefined;
  promiseMood?: PromiseMood | undefined;
  promiseMoodLabel?: string | undefined;
}

// RenderedPlayer is the server-internal branded flavor of WirePlayer. Only
// the server's rendering layer constructs values of this type; routes pass
// them straight to Hono which serializes them as WirePlayer on the wire.
export interface RenderedPlayer extends WirePlayer {
  readonly [RENDERED_BRAND]: never;
}

// A "new" player — the shape the generator produces before the DB assigns
// an id. Same as HiddenPlayer minus the id and the brand. The persistence
// layer inserts the row, reads back the id, and hands the full HiddenPlayer
// to downstream services.
export type NewHiddenPlayer = Omit<HiddenPlayer, "id" | typeof HIDDEN_BRAND>;

// Internal constructors. These are the ONLY sanctioned way to mint a value of
// either branded type — they exist so call sites can't silently forge one.
// The server's rendering module imports `asRenderedPlayer`; no one else
// should. `asHiddenPlayer` lives behind the `/types/hidden` side-door.

export function asHiddenPlayer<T extends Omit<HiddenPlayer, typeof HIDDEN_BRAND>>(
  v: T,
): HiddenPlayer {
  return v as unknown as HiddenPlayer;
}

export function asNewHiddenPlayer(v: NewHiddenPlayer): NewHiddenPlayer {
  // Identity function — kept for parity with the other minters so call sites
  // can document intent explicitly.
  return v;
}

export function asRenderedPlayer<T extends Omit<RenderedPlayer, typeof RENDERED_BRAND>>(
  v: T,
): RenderedPlayer {
  return v as unknown as RenderedPlayer;
}

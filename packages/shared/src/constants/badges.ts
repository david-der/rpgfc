import type { BadgeDefinition } from "../types/badge.js";

// Story 01 seed badge library. Not exhaustive — a deliberate curated slice
// that covers:
//   - All six categories (NaturalGift, MentalTrait, PositionalMastery,
//     EarnedSkill, Achievement, Relationship).
//   - Every effect type from the PRD §5.4 taxonomy (contextual_boost,
//     behavior_modifier, event_trigger, role_unlock, team_effect,
//     growth_modifier).
//
// The story 01 unit test asserts both of those coverage properties. Add a
// new badge here freely, but keep the minimum category count at 1 and the
// minimum effect type count at 1.
//
// Prose hooks use {name} as a substitution token. The rendering layer
// replaces it at render time with the player's display name.

function tieredBadge(
  key: string,
  category: BadgeDefinition["category"],
  tiers: Array<{ displayName: string; prose: string }>,
  extra: Omit<BadgeDefinition, "key" | "category" | "tiers" | "displayName">,
): BadgeDefinition {
  return {
    key,
    category,
    displayName: tiers[0]?.displayName ?? key,
    tiers: tiers.map((t, i) => ({ tier: i + 1, ...t })),
    ...extra,
  };
}

function flatBadge(
  key: string,
  category: BadgeDefinition["category"],
  displayName: string,
  prose: string,
  extra: Omit<BadgeDefinition, "key" | "category" | "tiers" | "displayName"> & {
    proseHooks?: string[];
  },
): BadgeDefinition {
  return {
    key,
    category,
    displayName,
    tiers: null,
    ...extra,
    proseHooks: extra.proseHooks ?? [prose],
  };
}

// ── NaturalGift — inborn physical / cognitive qualities ────────────────────

const TWO_FOOTED: BadgeDefinition = flatBadge(
  "two_footed",
  "NaturalGift",
  "Two-Footed",
  "{name} is comfortable on either foot.",
  {
    awardTrigger: "generation",
    conditions: { inbornRoll: true },
    effects: [
      { type: "behavior_modifier", modifier: "uses_weak_foot_without_cost", magnitude: 1 },
    ],
    proseHooks: [
      "{name} is equally at home on either foot.",
      "{name} shows no preference — the ball looks natural on either side.",
    ],
    decayRules: { kind: "none" },
  },
);

const LIGHTNING_QUICK: BadgeDefinition = flatBadge(
  "lightning_quick",
  "NaturalGift",
  "Lightning Quick",
  "When {name} gets a yard of space, nobody catches up.",
  {
    awardTrigger: "generation",
    conditions: { inbornRoll: true },
    effects: [
      { type: "contextual_boost", target: "pace", context: "open_field", magnitude: 8 },
    ],
    proseHooks: [
      "When {name} finds a yard of space, the chase is already over.",
    ],
    decayRules: { kind: "soft" },
  },
);

const HAWK_EYED: BadgeDefinition = flatBadge(
  "hawk_eyed",
  "NaturalGift",
  "Hawk-Eyed",
  "{name} sees passes most players never notice.",
  {
    awardTrigger: "generation",
    conditions: { inbornRoll: true },
    effects: [
      { type: "contextual_boost", target: "vision", context: "final_third", magnitude: 10 },
    ],
    proseHooks: ["{name} sees passes most players never imagine."],
    decayRules: { kind: "none" },
  },
);

const AERIAL_DOMINANCE: BadgeDefinition = flatBadge(
  "aerial_dominance",
  "NaturalGift",
  "Aerial Dominance",
  "In the air, {name} wins almost everything.",
  {
    awardTrigger: "generation",
    conditions: { inbornRoll: true },
    effects: [
      { type: "contextual_boost", target: "aerial", context: "any", magnitude: 12 },
    ],
    proseHooks: ["{name} goes up for headers and comes back down with the ball."],
    decayRules: { kind: "none" },
  },
);

const QUICK_REFLEXES: BadgeDefinition = flatBadge(
  "quick_reflexes",
  "NaturalGift",
  "Quick Reflexes",
  "{name}'s reactions in the box are the difference.",
  {
    awardTrigger: "generation",
    conditions: { inbornRoll: true },
    effects: [
      { type: "contextual_boost", target: "reflexes", context: "box", magnitude: 10 },
    ],
    proseHooks: ["{name} reacts before the shot has arrived."],
    decayRules: { kind: "soft" },
  },
);

// ── MentalTrait — personality-driven behavioral tendencies ─────────────────

const ICE_IN_VEINS: BadgeDefinition = flatBadge(
  "ice_in_veins",
  "MentalTrait",
  "Ice in Veins",
  "{name} plays late cup minutes the same as a friendly.",
  {
    awardTrigger: "career_milestone",
    conditions: { observedCalmUnderPressure: true },
    effects: [
      { type: "contextual_boost", target: "composure", context: "late_knockout", magnitude: 12 },
    ],
    proseHooks: [
      "{name} plays the last ten minutes of a final the same as a friendly.",
      "Pressure does not find {name}.",
    ],
    decayRules: { kind: "none" },
  },
);

const LEADER_OF_MEN: BadgeDefinition = tieredBadge(
  "leader_of_men",
  "MentalTrait",
  [
    { displayName: "Quiet Leader", prose: "{name} commands respect in the dressing room." },
    { displayName: "Leader of Men", prose: "When {name} speaks, the squad listens." },
    { displayName: "Captain Material", prose: "The squad follows {name} through any storm." },
  ],
  {
    awardTrigger: "season_end",
    conditions: { captainTenureSeasons: { gte: 1 } },
    effects: [
      { type: "team_effect", effect: "composure_boost", radius: "squad" },
      { type: "role_unlock", role: "captain" },
    ],
    proseHooks: [
      "The dressing room follows {name}.",
      "When {name} speaks, the others listen.",
    ],
    decayRules: { kind: "event_triggered" },
  },
);

const HOT_HEADED: BadgeDefinition = flatBadge(
  "hot_headed",
  "MentalTrait",
  "Hot-Headed",
  "{name} can lose composure when things go against them.",
  {
    awardTrigger: "career_milestone",
    conditions: { observedVolatility: true },
    effects: [
      { type: "behavior_modifier", modifier: "dissent_risk", magnitude: 2 },
    ],
    proseHooks: [
      "{name} has a short fuse.",
      "{name} will argue with a referee who is already walking away.",
    ],
    decayRules: { kind: "soft" },
  },
);

const TIRELESS_RUNNER: BadgeDefinition = flatBadge(
  "tireless_runner",
  "MentalTrait",
  "Tireless Runner",
  "{name} closes every angle and never seems to slow.",
  {
    awardTrigger: "season_end",
    conditions: { distancePer90: { gte: 11 } },
    effects: [
      { type: "contextual_boost", target: "stamina", context: "late_match", magnitude: 8 },
    ],
    proseHooks: [
      "{name} is still running in the ninetieth minute.",
    ],
    decayRules: { kind: "soft" },
  },
);

// ── PositionalMastery — role expertise earned through play ─────────────────

const INVERTED_WINGER: BadgeDefinition = tieredBadge(
  "inverted_winger",
  "PositionalMastery",
  [
    { displayName: "Cutting In", prose: "{name} cuts inside off the flank." },
    { displayName: "Inverted Winger", prose: "{name} reliably shapes chances from inside-left or inside-right." },
    { displayName: "Inside Maestro", prose: "{name} is a second playmaker wearing a winger's number." },
  ],
  {
    awardTrigger: "season_end",
    conditions: { inside_cut_chances_per_90: { gte: 1 } },
    effects: [
      { type: "role_unlock", role: "inverted_winger" },
    ],
    proseHooks: ["{name} drifts in off the touchline and makes the pitch half its size."],
    decayRules: { kind: "none" },
  },
);

const SWEEPER_KEEPER: BadgeDefinition = tieredBadge(
  "sweeper_keeper",
  "PositionalMastery",
  [
    { displayName: "Active Keeper", prose: "{name} reads play beyond the box." },
    { displayName: "Sweeper-Keeper", prose: "{name} is an eleventh outfield player in possession." },
    { displayName: "Libero-Keeper", prose: "{name} commands the top of the area as a defender." },
  ],
  {
    awardTrigger: "season_end",
    conditions: { clearances_outside_box_per_match: { gte: 0.5 } },
    effects: [{ type: "role_unlock", role: "sweeper_keeper" }],
    proseHooks: ["{name} patrols the top of the area like an extra center-back."],
    decayRules: { kind: "none" },
  },
);

const TARGET_MAN: BadgeDefinition = tieredBadge(
  "target_man",
  "PositionalMastery",
  [
    { displayName: "Hold-Up Threat", prose: "{name} holds the ball with teammates arriving." },
    { displayName: "Target Man", prose: "{name} is the team's focal point in the final third." },
    { displayName: "Wall of Nine", prose: "You cannot play past {name} in the box." },
  ],
  {
    awardTrigger: "season_end",
    conditions: { successful_hold_ups_per_90: { gte: 3 } },
    effects: [{ type: "role_unlock", role: "target_man" }],
    proseHooks: ["{name} holds the ball up like a wall."],
    decayRules: { kind: "soft" },
  },
);

const DEEP_LYING_PLAYMAKER: BadgeDefinition = tieredBadge(
  "deep_lying_playmaker",
  "PositionalMastery",
  [
    { displayName: "Tempo-Setter", prose: "{name} shapes the team's tempo from deep." },
    { displayName: "Deep-Lying Playmaker", prose: "{name} is the conductor of the midfield." },
    { displayName: "Regista", prose: "{name} runs matches from in front of the defense." },
  ],
  {
    awardTrigger: "season_end",
    conditions: { progressive_passes_per_90: { gte: 6 } },
    effects: [{ type: "role_unlock", role: "deep_lying_playmaker" }],
    proseHooks: ["{name} sets the tempo of the match from the base of midfield."],
    decayRules: { kind: "none" },
  },
);

// ── EarnedSkill — specific techniques developed over a career ──────────────

const CLUTCH_FINISHER: BadgeDefinition = tieredBadge(
  "clutch_finisher",
  "EarnedSkill",
  [
    { displayName: "Composed in the Moment", prose: "{name} is a reliable late finisher." },
    { displayName: "Clutch Finisher", prose: "{name} delivers when the match is on the line." },
    { displayName: "Ice Cold", prose: "In a cup final at eighty-nine minutes, {name} is the same player as in a friendly in July." },
  ],
  {
    awardTrigger: "season_end",
    conditions: { scored_in_knockout_after_65: { gte: 3 } },
    effects: [
      { type: "contextual_boost", target: "composure", context: "knockout_after_65min", magnitude: 10 },
    ],
    proseHooks: [
      "{name} has a reputation for stepping up when it matters.",
      "Even in the eighty-ninth minute, {name} looks calm.",
    ],
    decayRules: { kind: "none" },
  },
);

const PRESS_RESISTANT: BadgeDefinition = tieredBadge(
  "press_resistant",
  "EarnedSkill",
  [
    { displayName: "Under Pressure", prose: "{name} keeps possession when closed down." },
    { displayName: "Press Resistant", prose: "Two defenders on {name} is still not enough." },
    { displayName: "Unpressable", prose: "Swarming {name} is a trap — they see the out-ball first." },
  ],
  {
    awardTrigger: "season_end",
    conditions: { possession_retained_under_pressure: { percentile: 90 } },
    effects: [
      { type: "behavior_modifier", modifier: "plays_through_pressure", magnitude: 2 },
    ],
    proseHooks: [
      "Two defenders on {name} is not enough; three, probably not either.",
    ],
    decayRules: { kind: "soft" },
  },
);

const DEAD_BALL_SPECIALIST: BadgeDefinition = tieredBadge(
  "dead_ball_specialist",
  "EarnedSkill",
  [
    { displayName: "Dead Ball Student", prose: "{name} has a reliable technique from set pieces." },
    { displayName: "Dead Ball Specialist", prose: "{name} is dangerous from every free kick." },
    { displayName: "Set Piece Maestro", prose: "Opponents defend deep specifically because of {name}." },
  ],
  {
    awardTrigger: "season_end",
    conditions: { goals_from_set_pieces_per_season: { gte: 5 } },
    effects: [
      { type: "event_trigger", event: "takes_set_pieces_by_default" },
    ],
    proseHooks: ["Opponents defend set pieces differently because of {name}."],
    decayRules: { kind: "none" },
  },
);

const FIRST_TOUCH: BadgeDefinition = flatBadge(
  "first_touch",
  "EarnedSkill",
  "Velvet First Touch",
  "{name}'s first touch turns any pass into a usable chance.",
  {
    awardTrigger: "season_end",
    conditions: { first_touch_retention: { percentile: 90 } },
    effects: [
      { type: "contextual_boost", target: "composure", context: "first_touch", magnitude: 8 },
    ],
    proseHooks: ["{name}'s first touch is the difference between the chance and a throw-in."],
    decayRules: { kind: "soft" },
  },
);

const AERIAL_THREAT: BadgeDefinition = flatBadge(
  "aerial_threat",
  "EarnedSkill",
  "Aerial Threat",
  "Crosses toward {name} produce chances.",
  {
    awardTrigger: "season_end",
    conditions: { aerial_duels_won_per_match: { gte: 3 } },
    effects: [
      { type: "contextual_boost", target: "aerial", context: "attacking_set_piece", magnitude: 10 },
    ],
    proseHooks: ["Crosses find {name}."],
    decayRules: { kind: "none" },
  },
);

const DRIBBLE_MASTER: BadgeDefinition = flatBadge(
  "dribble_master",
  "EarnedSkill",
  "Dribble Master",
  "{name} changes matches with the ball at their feet.",
  {
    awardTrigger: "season_end",
    conditions: { successful_dribbles_per_90: { gte: 4 } },
    effects: [
      { type: "contextual_boost", target: "pace", context: "one_v_one", magnitude: 6 },
    ],
    proseHooks: ["Give {name} a one-v-one and the odds are already theirs."],
    decayRules: { kind: "soft" },
  },
);

const LONG_RANGE_SHOOTER: BadgeDefinition = flatBadge(
  "long_range_shooter",
  "EarnedSkill",
  "Long Range Shooter",
  "{name} is a threat from anywhere in the final third.",
  {
    awardTrigger: "season_end",
    conditions: { goals_from_outside_box: { gte: 3 } },
    effects: [
      { type: "contextual_boost", target: "finishing", context: "outside_box", magnitude: 8 },
    ],
    proseHooks: ["{name} scores from distance."],
    decayRules: { kind: "none" },
  },
);

// ── Achievement — historical accomplishments ───────────────────────────────

const ACADEMY_GRADUATE: BadgeDefinition = flatBadge(
  "academy_graduate",
  "Achievement",
  "Academy Graduate",
  "{name} came through the club's academy.",
  {
    awardTrigger: "career_milestone",
    conditions: { senior_debut_as_academy: true },
    effects: [
      { type: "growth_modifier", target: "club_chemistry", magnitude: 2 },
    ],
    proseHooks: ["{name} grew up wearing this shirt."],
    decayRules: { kind: "none" },
  },
);

const GOLDEN_BOOT_NOMINEE: BadgeDefinition = flatBadge(
  "golden_boot_nominee",
  "Achievement",
  "Golden Boot Nominee",
  "{name} finished a season among the league's top scorers.",
  {
    awardTrigger: "season_end",
    conditions: { league_top_scorer_rank: { lte: 3 } },
    effects: [
      { type: "growth_modifier", target: "reputation", magnitude: 3 },
    ],
    proseHooks: ["{name} finished a season among the league's top scorers."],
    decayRules: { kind: "none" },
  },
);

const CUP_FINAL_HERO: BadgeDefinition = flatBadge(
  "cup_final_hero",
  "Achievement",
  "Cup Final Hero",
  "{name} scored the winner in a cup final.",
  {
    awardTrigger: "match_end",
    conditions: { match_context: "cup_final", goals_scored: { gte: 1 } },
    effects: [{ type: "event_trigger", event: "legendary_moment" }],
    proseHooks: ["{name} scored the winner on the biggest day."],
    decayRules: { kind: "none" },
  },
);

const IRON_MAN: BadgeDefinition = flatBadge(
  "iron_man",
  "Achievement",
  "Iron Man",
  "{name} played every available minute in a full season.",
  {
    awardTrigger: "season_end",
    conditions: { minutes_percent: { gte: 0.95 } },
    effects: [
      { type: "contextual_boost", target: "stamina", context: "any", magnitude: 5 },
    ],
    proseHooks: ["{name} played every minute the team needed."],
    decayRules: { kind: "none" },
  },
);

const CONSISTENCY: BadgeDefinition = tieredBadge(
  "consistency",
  "Achievement",
  [
    { displayName: "Reliable", prose: "{name} can be counted on week after week." },
    { displayName: "Consistent Performer", prose: "{name} never has a bad month." },
    { displayName: "Metronome", prose: "{name}'s worst game is still a good game." },
  ],
  {
    awardTrigger: "season_end",
    conditions: { rating_std_dev: { lte: 0.3 } },
    effects: [
      { type: "growth_modifier", target: "form_volatility", magnitude: -2 },
    ],
    proseHooks: ["{name}'s worst game is still a good game."],
    decayRules: { kind: "soft" },
  },
);

// ── Relationship — connections to people and places ───────────────────────

const COACHS_FAVOURITE: BadgeDefinition = flatBadge(
  "coachs_favourite",
  "Relationship",
  "Coach's Favourite",
  "The coach trusts {name} more than most.",
  {
    awardTrigger: "season_end",
    conditions: { training_bond_with_coach: { gte: 3 } },
    effects: [
      { type: "team_effect", effect: "coach_bond_boost", radius: "adjacent" },
    ],
    proseHooks: ["The coach has a soft spot for {name}."],
    decayRules: { kind: "event_triggered" },
  },
);

const FAN_FAVOURITE: BadgeDefinition = tieredBadge(
  "fan_favourite",
  "Relationship",
  [
    { displayName: "Popular", prose: "The terraces warm to {name}." },
    { displayName: "Fan Favourite", prose: "The crowd sings {name}'s name." },
    { displayName: "Terrace Legend", prose: "The fans have a chant for {name}." },
  ],
  {
    awardTrigger: "season_end",
    conditions: { fan_sentiment: { gte: 4 } },
    effects: [
      { type: "team_effect", effect: "home_atmosphere_boost", radius: "squad" },
    ],
    proseHooks: ["The supporters have a chant for {name}."],
    decayRules: { kind: "event_triggered" },
  },
);

const DERBY_LEGEND: BadgeDefinition = flatBadge(
  "derby_legend",
  "Relationship",
  "Derby Legend",
  "{name} has decided more than one local derby.",
  {
    awardTrigger: "career_milestone",
    conditions: { derby_winning_goals: { gte: 2 } },
    effects: [
      { type: "contextual_boost", target: "composure", context: "derby", magnitude: 8 },
    ],
    proseHooks: ["{name} comes alive in derby week."],
    decayRules: { kind: "none" },
  },
);

// ── Library export ─────────────────────────────────────────────────────────

export const BADGE_LIBRARY: readonly BadgeDefinition[] = [
  // NaturalGift (5)
  TWO_FOOTED,
  LIGHTNING_QUICK,
  HAWK_EYED,
  AERIAL_DOMINANCE,
  QUICK_REFLEXES,
  // MentalTrait (4)
  ICE_IN_VEINS,
  LEADER_OF_MEN,
  HOT_HEADED,
  TIRELESS_RUNNER,
  // PositionalMastery (4)
  INVERTED_WINGER,
  SWEEPER_KEEPER,
  TARGET_MAN,
  DEEP_LYING_PLAYMAKER,
  // EarnedSkill (7)
  CLUTCH_FINISHER,
  PRESS_RESISTANT,
  DEAD_BALL_SPECIALIST,
  FIRST_TOUCH,
  AERIAL_THREAT,
  DRIBBLE_MASTER,
  LONG_RANGE_SHOOTER,
  // Achievement (5)
  ACADEMY_GRADUATE,
  GOLDEN_BOOT_NOMINEE,
  CUP_FINAL_HERO,
  IRON_MAN,
  CONSISTENCY,
  // Relationship (3)
  COACHS_FAVOURITE,
  FAN_FAVOURITE,
  DERBY_LEGEND,
] as const;

export const BADGE_BY_KEY: Record<string, BadgeDefinition> = Object.fromEntries(
  BADGE_LIBRARY.map((b) => [b.key, b]),
);

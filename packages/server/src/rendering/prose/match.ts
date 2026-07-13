// Match narrative prose builder — Story 06.
//
// Stitches a four-paragraph match report from the engine's
// SimMatchResult-style outputs (already mapped to RenderedMatch by
// the time we land here, but we work with the structural shape so
// the function stays pure).
//
// The narrative is deterministic given the match seed: it draws
// adjectives + sentence templates from a fixed pool through the
// same mulberry32 PRNG the sim uses.
//
// The body never names a tier or a number — the rendering layer
// handles goal counts via the allowlisted DOM elements. Prose
// stays qualitative.

import type { RenderedMatchClub, RenderedMatchPerformance } from "@rpgfc/shared";

import { mulberry32 } from "../../application/generation/rng.js";
import { BAND_ADJECTIVES, bandFor } from "../../sim/prose.js";

export interface MatchNarrativeInput {
  seed: number;
  home: RenderedMatchClub;
  away: RenderedMatchClub;
  performances: RenderedMatchPerformance[];
  /** Stable cause codes read from the persisted match event ledger. */
  evidence: string[];
}

const VENUE_PHRASES = [
  "at the home ground",
  "in front of the home crowd",
  "in difficult conditions",
  "on a heavy pitch",
];

function pickStandouts(
  performances: RenderedMatchPerformance[],
  clubId: number,
): RenderedMatchPerformance[] {
  const sideOnly = performances.filter((p) => p.clubId === clubId);
  const ranked = [...sideOnly].sort((a, b) => {
    const goals = b.goals - a.goals;
    if (goals !== 0) return goals;
    return b.assists - a.assists;
  });
  return ranked.slice(0, 2);
}

export function buildMatchNarrative(input: MatchNarrativeInput): string[] {
  const homeGoals = input.home.goals ?? 0;
  const awayGoals = input.away.goals ?? 0;
  const rng = mulberry32((input.seed ^ 0xb16b00b5) >>> 0);

  const band = bandFor(homeGoals, awayGoals);
  const adjective = rng.pick(BAND_ADJECTIVES[band]);
  const venuePhrase = rng.pick(VENUE_PHRASES);

  const winner = homeGoals === awayGoals ? null : homeGoals > awayGoals ? input.home : input.away;
  const loser = homeGoals === awayGoals ? null : winner === input.home ? input.away : input.home;

  const homeStandouts = pickStandouts(input.performances, input.home.id);
  const awayStandouts = pickStandouts(input.performances, input.away.id);

  // ── Lead paragraph: scoreline framing + the top scorer's prose. ────────
  const lead: string[] = [];
  if (winner && loser) {
    lead.push(`${adjective} afternoon ${venuePhrase} for ${winner.name}.`);
  } else {
    lead.push(`${adjective} afternoon ${venuePhrase}.`);
  }
  // The first standout with a goal becomes the prose subject.
  const firstScorer =
    [...homeStandouts, ...awayStandouts].find((p) => p.goals > 0 && p.eventDescription) ?? null;
  if (firstScorer && firstScorer.eventDescription) {
    lead.push(`${firstScorer.playerName} ${firstScorer.eventDescription}.`);
  }

  // ── Tactical paragraph: only claims causes persisted by the engine. ────
  const evidence = new Set(input.evidence);
  const tactical = evidence.has("COUNTER_V_HIGH_LINE")
    ? "Transitions repeatedly found space behind the high line, turning regains into immediate danger."
    : evidence.has("HIGH_PRESS") || evidence.has("PRESSURE_FORCED_TURNOVER")
      ? "The press repeatedly disrupted build-up, forcing rushed possession and creating the clearest territorial swings."
      : evidence.has("POSSESSION_STRUCTURE") || evidence.has("PLAY_OUT_FROM_BACK")
        ? "Patient possession and structured build-up created the platform for the strongest attacking spells."
        : evidence.has("FINAL_THIRD_CREATION")
          ? "The decisive pattern came through composed final-third creation rather than isolated chances."
          : "The contest was shaped by the struggle to turn build-up into controlled possession.";

  const flow =
    homeGoals === awayGoals
      ? "Neither side held control for long; each response changed the rhythm before the other could settle."
      : winner && loser
        ? `${winner.name} managed the important phases more cleanly, while ${loser.name} were left chasing the changing rhythm.`
        : "The balance shifted often enough to leave both benches with decisions to revisit.";

  const standout = [...homeStandouts, ...awayStandouts][0];
  const personnel = standout
    ? standout.eventDescription
      ? `${standout.playerName} ${standout.eventDescription}, providing the clearest individual thread through the match.`
      : `${standout.playerName} remained central to the strongest passages of play.`
    : "The important work was spread across both units rather than resting on one obvious figure.";

  // ── Closing line: a single short summary. ─────────────────────────────
  const closingPool = [
    "A clean result.",
    "An honest contest.",
    "Plenty for both managers to think about.",
    "Few scares, fewer surprises.",
  ];
  const closing = rng.pick(closingPool);

  return [lead.join(" "), tactical, `${flow} ${personnel}`, closing];
}

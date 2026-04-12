// Match narrative prose builder — Story 06.
//
// Stitches a 2–3 paragraph match report from the engine's
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

  const winner =
    homeGoals === awayGoals
      ? null
      : homeGoals > awayGoals
        ? input.home
        : input.away;
  const loser =
    homeGoals === awayGoals ? null : winner === input.home ? input.away : input.home;

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
    [...homeStandouts, ...awayStandouts].find((p) => p.goals > 0 && p.eventDescription) ??
    null;
  if (firstScorer && firstScorer.eventDescription) {
    lead.push(`${firstScorer.playerName} ${firstScorer.eventDescription}.`);
  }

  // ── Body paragraph: the losing or drawn side's reply. ──────────────────
  const body: string[] = [];
  const replyCandidates =
    loser !== null
      ? input.performances.filter((p) => p.clubId === loser.id && p.eventDescription !== null)
      : input.performances.filter((p) => p.eventDescription !== null);
  const reply = replyCandidates[0];
  if (reply && reply.eventDescription) {
    body.push(`${reply.playerName} ${reply.eventDescription}.`);
  }

  // ── Closing line: a single short summary. ─────────────────────────────
  const closingPool = [
    "A clean result.",
    "An honest contest.",
    "Plenty for both managers to think about.",
    "Few scares, fewer surprises.",
  ];
  const closing = rng.pick(closingPool);

  const paragraphs: string[] = [];
  if (lead.length > 0) paragraphs.push(lead.join(" "));
  if (body.length > 0) paragraphs.push(body.join(" "));
  paragraphs.push(closing);
  return paragraphs;
}

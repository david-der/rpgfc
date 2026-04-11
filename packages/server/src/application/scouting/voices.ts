// Scout voice templates — Story 03.
//
// Three distinct voices, each with ≥5 sentence shapes. The prose generator
// picks a shape deterministically from a (player_id, assignment_id, voice_id)
// hash so the same scout writes the same sentence about the same player
// across page reloads. Each shape uses substitution tokens:
//
//   {player}      — player name
//   {positional}  — short position label ("striker", "winger")
//   {gift_top}    — tier word for the player's strongest hidden gift
//   {gift_weak}   — tier word for the player's weakest hidden gift
//   {label_top}   — label word for the strongest gift ("pace", "distribution")
//   {label_weak}  — label word for the weakest gift
//
// Voices do NOT render digits. Ever. The no-numbers doctrine applies
// inside prose too.

import type { ScoutVoice, ScoutVoiceId } from "@rpgfc/shared";

export const VOICE_CATALOGUE: Record<ScoutVoiceId, ScoutVoice> = {
  dry_precise: { id: "dry_precise", description: "dry and precise" },
  warm_effusive: { id: "warm_effusive", description: "warm and effusive" },
  terse_cautious: { id: "terse_cautious", description: "terse and cautious" },
};

export const VOICE_SHAPES: Record<ScoutVoiceId, readonly string[]> = {
  dry_precise: [
    "Watched {player} twice this week. The {label_top} is real — call it {gift_top}.",
    "{player} — three sessions, one match. Pace is real. The {label_weak} is still {gift_weak}.",
    "{player}: good technical discipline. {label_top} reads as {gift_top}; {label_weak} as {gift_weak}.",
    "Call me cautious on {player}, but the {label_top} is the real thing — {gift_top} by any honest measure.",
    "Quiet profile on {player}: {gift_top} on {label_top} and nothing else I can confirm yet.",
  ],
  warm_effusive: [
    "A magical afternoon with {player} — what a {positional}. The {label_top} is properly {gift_top}.",
    "You would love {player}. The {label_top} is {gift_top}, the {label_weak} only {gift_weak}, but the talent is unmistakable.",
    "I sat in the stand for {player} and came away smiling. {gift_top} {label_top}, and he moves with intent.",
    "{player} is one of the happy surprises of the trip. {gift_top} on the {label_top}, honest on the rest.",
    "Cannot say enough about {player} — {gift_top} in every moment I saw, and the {positional} instincts are there.",
  ],
  terse_cautious: [
    "{player}: {gift_top} {label_top}. {gift_weak} {label_weak}. That is all I can say for now.",
    "One look at {player}. {gift_top} {label_top} — everything else needs another visit.",
    "Watched {player}. {label_top} reads {gift_top}. Not yet ready to vouch for the rest.",
    "{player} — promising on {label_top}, less convinced on {label_weak}. Asking for a second trip.",
    "{player}, taken with a pinch of salt: {gift_top} {label_top}, the {label_weak} still {gift_weak}.",
  ],
};

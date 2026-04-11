// Type-only test for the rendering-boundary brands.
// Story 00 / design doctrine: HiddenPlayer and RenderedPlayer must be
// nominally distinct at compile time so that an accidental return path from
// service → route cannot silently leak hidden state.
//
// This file is checked by `tsc --noEmit` (pnpm typecheck). It is NOT a
// runtime test — it lives next to the type file it exercises.

import { expectTypeOf } from "vitest";

import type { BadgeRef, CertaintyTier, MentalTraits, NaturalGifts, RenderedPlayer } from "../index.js";
import type { HiddenPlayer } from "../types/hidden.js";
import { asHiddenPlayer } from "../types/hidden.js";
import { asRenderedPlayer } from "../types/player.js";

const blankGifts: NaturalGifts = {
  pace: 50,
  finishing: 50,
  composure: 50,
  aerial: 50,
  tackling: 50,
  passing: 50,
  vision: 50,
  stamina: 50,
  strength: 50,
  reflexes: 50,
};

const blankTraits: MentalTraits = {
  ambition: 50,
  leadership: 50,
  temperament: 50,
  workEthic: 50,
  sociability: 50,
  riskTolerance: 50,
  professionalism: 50,
};

const hidden: HiddenPlayer = asHiddenPlayer({
  id: 1,
  runId: 1,
  clubId: null,
  name: "Juan Moreno",
  dob: "2002-03-14",
  nationality: "ES",
  preferredFoot: "Left",
  archetypeId: "inverted_winger",
  hiddenAttrs: blankGifts,
  mentalTraits: blankTraits,
  badgeKeys: [],
  experienceYears: 3,
  narrativeSeed: { hometown: "Málaga", story: "academy product" },
});

const rendered: RenderedPlayer = asRenderedPlayer({
  id: 1,
  name: "Juan Moreno",
  age: 24,
  nationality: "ES",
  preferredFoot: "Left",
  positionLabel: "LW",
  club: null,
  badges: [] as BadgeRef[],
  prose: { identity: "", currentForm: "" },
  certainty: "Confident" satisfies CertaintyTier,
  experience: "Developing",
});

// Brands must be distinct — neither direction should be assignable.
expectTypeOf(hidden).not.toEqualTypeOf<RenderedPlayer>();
expectTypeOf(rendered).not.toEqualTypeOf<HiddenPlayer>();

// RenderedPlayer's public surface must carry prose, badges, certainty,
// experience — the load-bearing fields that the UI renders.
expectTypeOf<RenderedPlayer>().toHaveProperty("prose");
expectTypeOf<RenderedPlayer>().toHaveProperty("badges");
expectTypeOf<RenderedPlayer>().toHaveProperty("certainty");
expectTypeOf<RenderedPlayer>().toHaveProperty("experience");

// HiddenPlayer carries the numeric vectors that NEVER cross the wire.
expectTypeOf<HiddenPlayer>().toHaveProperty("hiddenAttrs");
expectTypeOf<HiddenPlayer>().toHaveProperty("mentalTraits");

// Type-only test for the rendering-boundary brands.
// Story 00 / design doctrine: HiddenPlayer and RenderedPlayer must be
// nominally distinct at compile time so that an accidental return path from
// service → route cannot silently leak hidden state.
//
// This file is checked by `tsc --noEmit` (pnpm typecheck). It is NOT a
// runtime test — it lives next to the type file it exercises.

import { expectTypeOf } from "vitest";
import type { HiddenPlayer } from "../types/hidden.js";
import type { RenderedPlayer, BadgeRef, CertaintyTier } from "../index.js";
import { asHiddenPlayer } from "../types/hidden.js";
import { asRenderedPlayer } from "../types/player.js";

const hidden: HiddenPlayer = asHiddenPlayer({ id: 1, name: "Juan Moreno" });
const rendered: RenderedPlayer = asRenderedPlayer({
  id: 1,
  name: "Juan Moreno",
  badges: [] as BadgeRef[],
  certainty: "Confident" satisfies CertaintyTier,
});

// Brands must be distinct — neither direction should be assignable.
expectTypeOf(hidden).not.toEqualTypeOf<RenderedPlayer>();
expectTypeOf(rendered).not.toEqualTypeOf<HiddenPlayer>();

// And RenderedPlayer must expose the public surface (badges, certainty).
expectTypeOf<RenderedPlayer>().toHaveProperty("badges");
expectTypeOf<RenderedPlayer>().toHaveProperty("certainty");

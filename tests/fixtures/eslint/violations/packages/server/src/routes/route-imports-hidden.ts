// Story 00 AC-05: deliberate violation fixture for no-hidden-in-routes.
//
// This file is physically located under tests/fixtures/eslint/violations/ so
// it stays out of the real build, BUT its path mirrors the server's routes/
// structure so the rule's filename predicate (matches
// /packages[/\\]server[/\\]src[/\\]routes[/\\]/) fires on it.
//
// Expected lint errors:
//   rpgfc/no-hidden-in-routes — importing from ../application/players
//   rpgfc/no-hidden-in-routes — importing from @rpgfc/shared/types/hidden

// @ts-nocheck

import { foo } from "../application/players";
import type { HiddenPlayer } from "@rpgfc/shared/types/hidden";

export const bad = (x: HiddenPlayer) => foo(x);

// ContinueButton — Style Guide v1.1 §15: the game loop's single
// persistent, context-aware primary action. Lives at the right end of
// the masthead on every screen; the only moss-filled element there.
//
// Chrome, not player-facing: the week number is calendar fact in nav
// territory, outside the doctrine surface by design (see nav-shell
// doctrine spec).

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { advanceMatchday, endSeason, fetchSeasonState } from "../../lib/api";

const TOTAL_MATCH_WEEKS = 18;

export function ContinueButton() {
  const queryClient = useQueryClient();
  const seasonQ = useQuery({ queryKey: ["season-state"], queryFn: fetchSeasonState });
  const proceed = useMutation({
    mutationFn: async (mode: "advance" | "end") =>
      mode === "advance" ? advanceMatchday() : endSeason(),
    onSettled: () => queryClient.invalidateQueries(),
  });

  const state = seasonQ.data;
  if (!state) return null;
  const seasonDone = state.matchWeek > TOTAL_MATCH_WEEKS;
  const label = seasonDone ? "End season" : `Advance · Week ${state.matchWeek}`;

  return (
    <button
      type="button"
      onClick={() => proceed.mutate(seasonDone ? "end" : "advance")}
      disabled={proceed.isPending}
      className="ml-auto inline-flex h-8 flex-none items-center bg-moss-600 px-4 font-sans text-xs font-semibold uppercase tracking-wide text-parchment-50 outline-offset-2 transition-colors hover:bg-moss-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-moss-400 disabled:opacity-60"
    >
      {proceed.isPending ? "Playing the week…" : label}
    </button>
  );
}

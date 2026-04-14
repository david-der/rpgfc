// Cross-cutting player-preview modal. Any row anywhere (squad, scouts,
// watchlist, offers, bids) can call `openPlayer(id)` and get a pop-out
// trading card with a flip side for per-season stats.
//
// Context-based because this is a genuine cross-cutting concern
// (packages/web/CLAUDE.md §8). Router search-params would have
// collided across the tabbed pages' own search schemas.

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

import { PlayerModal } from "./ui/PlayerModal";

interface PlayerModalValue {
  open: (playerId: number) => void;
  close: () => void;
}

const Ctx = createContext<PlayerModalValue | null>(null);

export function PlayerModalProvider({ children }: { children: ReactNode }) {
  const [playerId, setPlayerId] = useState<number | null>(null);
  const close = useCallback(() => setPlayerId(null), []);
  return (
    <Ctx.Provider value={{ open: setPlayerId, close }}>
      {children}
      {playerId !== null && <PlayerModal playerId={playerId} onClose={close} />}
    </Ctx.Provider>
  );
}

export function usePlayerModal(): PlayerModalValue {
  const ctx = useContext(Ctx);
  if (!ctx) {
    // Safe no-op when the provider isn't mounted (e.g. unit tests).
    return { open: () => undefined, close: () => undefined };
  }
  return ctx;
}

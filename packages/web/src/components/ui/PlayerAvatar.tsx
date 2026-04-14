// PlayerAvatar — bite-sized sister to PlayerCard. Same sketch-on-
// parchment aesthetic, sized for list rows (squad page, watchlist,
// rosters). Reuses the /player-art/{id}.png convention with a fallback
// to default.png so dropping in per-player art lights up everywhere.
//
// `rounded-full` is one of the two radius exceptions allowed by the
// Style Guide (the other is the default 0 everywhere else). Avatars
// qualify — circles + dots are the cited example. See packages/web/CLAUDE.md.

import { useState } from "react";

interface PlayerAvatarProps {
  playerId: number;
  size?: number; // px
  /** Optional accent ring (club color). Falls back to parchment-700. */
  ringColor?: string;
}

export function PlayerAvatar({ playerId, size = 48, ringColor }: PlayerAvatarProps) {
  const [src, setSrc] = useState(`/player-art/${playerId}.png`);
  return (
    <span
      className="inline-block flex-none overflow-hidden rounded-full border-2 bg-parchment-100"
      style={{ width: size, height: size, borderColor: ringColor ?? "#3D3220" }}
      aria-hidden
    >
      <img
        src={src}
        onError={() => {
          if (!src.endsWith("default.png")) setSrc("/player-art/default.png");
        }}
        alt=""
        className="block h-full w-full object-cover object-center"
        style={{
          // Same sepia/contrast/multiply as the bigger surfaces — keeps
          // the visual language consistent at thumbnail size.
          filter: "sepia(0.15) contrast(1.05) saturate(0.85)",
          mixBlendMode: "multiply",
        }}
      />
    </span>
  );
}

// Stable fixture seed shared by initial generation and season rollover.
// Season is part of the hash so identical pairings do not replay the same
// random stream every year.

export function fixtureSeed(
  worldSeed: number,
  season: number,
  matchday: number,
  homeId: number,
  awayId: number,
): number {
  let hash = worldSeed | 0;
  hash = Math.imul(hash ^ season, 73_856_093);
  hash = Math.imul(hash ^ matchday, 19_349_663);
  hash = Math.imul(hash ^ homeId, 83_492_791);
  hash = Math.imul(hash ^ awayId, 2_654_435_761);
  return hash >>> 0;
}

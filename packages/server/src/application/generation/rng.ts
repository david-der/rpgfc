// Seeded PRNG — mulberry32. Deterministic, cheap, and good enough for
// generation noise. Story 01 AC-05 asserts that two worlds generated from
// the same seed are bit-for-bit identical, so every random call in the
// generation pipeline must route through an instance of this type.
//
// Never `Math.random()`. If you find yourself about to, either:
//   - plumb a `Random` down from the caller, or
//   - use the fixed `defaultRandom` below for a deterministic default.

export interface Random {
  /** Uniform [0, 1). */
  next(): number;
  /** Integer in [lo, hi]. */
  int(lo: number, hi: number): number;
  /** Sample one element from a non-empty array. */
  pick<T>(arr: readonly T[]): T;
  /** Weighted sample given a parallel weights array. */
  weighted<T>(arr: readonly T[], weights: readonly number[]): T;
  /** Normal distribution via Box-Muller. */
  normal(mean: number, stddev: number): number;
  /** Bernoulli roll. */
  chance(p: number): boolean;
  /** Fork a deterministic child PRNG from the current state. */
  fork(tag: number): Random;
}

export function mulberry32(seed: number): Random {
  // Mulberry32 — tiny, deterministic, good enough for game content.
  let a = seed >>> 0;

  const next = (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const random: Random = {
    next,
    int(lo, hi) {
      if (hi < lo) throw new Error("int(lo, hi): hi < lo");
      return lo + Math.floor(next() * (hi - lo + 1));
    },
    pick<T>(arr: readonly T[]): T {
      if (arr.length === 0) throw new Error("pick(): empty array");
      return arr[Math.floor(next() * arr.length)]!;
    },
    weighted<T>(arr: readonly T[], weights: readonly number[]): T {
      if (arr.length === 0) throw new Error("weighted(): empty array");
      if (arr.length !== weights.length) {
        throw new Error("weighted(): parallel arrays must match length");
      }
      const total = weights.reduce((acc, w) => acc + w, 0);
      if (total <= 0) throw new Error("weighted(): non-positive total weight");
      let roll = next() * total;
      for (let i = 0; i < arr.length; i++) {
        roll -= weights[i]!;
        if (roll < 0) return arr[i]!;
      }
      return arr[arr.length - 1]!;
    },
    normal(mean, stddev) {
      // Box-Muller transform using two uniform samples. Clamping to a small
      // epsilon avoids Math.log(0) = -Infinity.
      const u1 = Math.max(next(), 1e-12);
      const u2 = next();
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      return mean + z * stddev;
    },
    chance(p) {
      return next() < p;
    },
    fork(tag) {
      // Hash the current state + tag into a new seed. The parent RNG is
      // advanced by two steps so forking is observable but still
      // deterministic.
      const mix = (a ^ (tag * 0x9e3779b1)) >>> 0;
      next();
      next();
      return mulberry32(mix);
    },
  };

  return random;
}

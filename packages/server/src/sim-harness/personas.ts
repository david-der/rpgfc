// Season simulation personas — 10 distinct manager archetypes.
//
// Each persona receives a snapshot of the league state once per match
// week and returns a list of actions. The harness applies them via
// the same application-layer functions the HTTP routes call.

import type { CurrencyTier, PlayingTimeRole } from "@rpgfc/shared";

export interface ClubSnapshot {
  clubId: number;
  clubName: string;
  reputationTier: string;
  cashCents: number;
  wageBillCents: number;
  wageBudgetCents: number;
  squadSize: number;
  leaguePosition: number; // 1..10
  lastResult: "W" | "D" | "L" | null;
}

export interface ListingSnapshot {
  playerId: number;
  playerName: string;
  clubId: number;
  positionFamily: "gk" | "defender" | "midfielder" | "forward";
  askingPriceCents: number;
  age: number;
  badgeCount: number;
  formTier: string | null;
}

export interface OwnedPlayerSnapshot {
  playerId: number;
  playerName: string;
  age: number;
  seasonsRemaining: number;
  weeklyWageCents: number;
  rolePromise: PlayingTimeRole;
  formTier: string | null;
  squadRole: string | null;
}

export interface PersonaContext {
  matchWeek: number;
  season: number;
  club: ClubSnapshot;
  ownedPlayers: OwnedPlayerSnapshot[];
  marketListings: ListingSnapshot[];
}

export type Action =
  | {
      kind: "bid";
      playerId: number;
      feeTier: CurrencyTier;
      wageTier: CurrencyTier;
      rolePromise: PlayingTimeRole;
    }
  | {
      kind: "extend";
      playerId: number;
      wageTier: CurrencyTier;
      seasons: number;
      rolePromise: PlayingTimeRole;
    };

export interface Persona {
  name: string;
  tagline: string;
  decide(ctx: PersonaContext): Action[];
}

// ── helpers ──────────────────────────────────────────────────────────────

function pickBestTarget(
  listings: ListingSnapshot[],
  filter: (l: ListingSnapshot) => boolean,
): ListingSnapshot | null {
  const candidates = listings.filter(filter);
  if (candidates.length === 0) return null;
  return candidates.reduce((best, l) =>
    l.badgeCount > best.badgeCount ? l : best,
  );
}

function tierForPrice(cents: number): CurrencyTier {
  if (cents <= 50_000_000_00) return "Minimal";
  if (cents <= 200_000_000_00) return "Modest";
  if (cents <= 1_000_000_000_00) return "Notable";
  if (cents <= 3_000_000_000_00) return "Significant";
  return "Elite";
}

// ── personas ─────────────────────────────────────────────────────────────

export const MARQUEE: Persona = {
  name: "The Marquee",
  tagline: "Aggressive spender — targets marquee signings at Elite prices",
  decide(ctx) {
    const actions: Action[] = [];
    // Bid on up to one high-badge forward or winger per week if cash allows.
    const target = pickBestTarget(
      ctx.marketListings,
      (l) =>
        (l.positionFamily === "forward" || l.positionFamily === "midfielder") &&
        l.badgeCount >= 2 &&
        l.askingPriceCents <= ctx.club.cashCents,
    );
    if (target) {
      actions.push({
        kind: "bid",
        playerId: target.playerId,
        feeTier: tierForPrice(target.askingPriceCents),
        wageTier: "Significant",
        rolePromise: "Star Player",
      });
    }
    // Extend any starter whose contract is in the last season at Elite wage.
    for (const p of ctx.ownedPlayers) {
      if (p.seasonsRemaining <= 1 && p.age < 30) {
        actions.push({
          kind: "extend",
          playerId: p.playerId,
          wageTier: "Significant",
          seasons: 4,
          rolePromise: "Star Player",
        });
      }
    }
    return actions;
  },
};

export const ANALYST: Persona = {
  name: "The Analyst",
  tagline: "Bargain hunter — signs young players at Minimal/Modest tiers",
  decide(ctx) {
    const actions: Action[] = [];
    const target = pickBestTarget(
      ctx.marketListings,
      (l) =>
        l.age <= 23 &&
        l.askingPriceCents <= 200_000_000_00 &&
        l.askingPriceCents <= ctx.club.cashCents,
    );
    if (target) {
      actions.push({
        kind: "bid",
        playerId: target.playerId,
        feeTier: tierForPrice(target.askingPriceCents),
        wageTier: "Modest",
        rolePromise: "Rotation",
      });
    }
    return actions;
  },
};

export const ARCHITECT: Persona = {
  name: "The Architect",
  tagline: "Youth developer — locks in young players with long extensions",
  decide(ctx) {
    const actions: Action[] = [];
    // Young player target.
    const target = pickBestTarget(
      ctx.marketListings,
      (l) => l.age <= 21 && l.askingPriceCents <= ctx.club.cashCents,
    );
    if (target) {
      actions.push({
        kind: "bid",
        playerId: target.playerId,
        feeTier: tierForPrice(target.askingPriceCents),
        wageTier: "Modest",
        rolePromise: "Rotation",
      });
    }
    // Extend every young player with 2 or fewer seasons remaining.
    for (const p of ctx.ownedPlayers) {
      if (p.age <= 24 && p.seasonsRemaining <= 2) {
        actions.push({
          kind: "extend",
          playerId: p.playerId,
          wageTier: "Notable",
          seasons: 5,
          rolePromise: "Important Player",
        });
      }
    }
    return actions;
  },
};

export const TRADITIONALIST: Persona = {
  name: "The Traditionalist",
  tagline: "No new signings — focus on extending the existing squad",
  decide(ctx) {
    const actions: Action[] = [];
    for (const p of ctx.ownedPlayers) {
      if (p.seasonsRemaining <= 1 && p.age < 32) {
        actions.push({
          kind: "extend",
          playerId: p.playerId,
          wageTier: "Modest",
          seasons: 3,
          rolePromise: "Important Player",
        });
      }
    }
    return actions;
  },
};

export const OPPORTUNIST: Persona = {
  name: "The Opportunist",
  tagline: "Reactionary — bids after losses, extends after wins",
  decide(ctx) {
    const actions: Action[] = [];
    if (ctx.club.lastResult === "L") {
      const target = pickBestTarget(
        ctx.marketListings,
        (l) =>
          l.badgeCount >= 1 && l.askingPriceCents <= ctx.club.cashCents,
      );
      if (target) {
        actions.push({
          kind: "bid",
          playerId: target.playerId,
          feeTier: tierForPrice(target.askingPriceCents),
          wageTier: "Notable",
          rolePromise: "Important Player",
        });
      }
    } else if (ctx.club.lastResult === "W") {
      const star = ctx.ownedPlayers
        .filter((p) => p.seasonsRemaining <= 2 && p.formTier === "Excellent")
        .sort((a, b) => b.weeklyWageCents - a.weeklyWageCents)[0];
      if (star) {
        actions.push({
          kind: "extend",
          playerId: star.playerId,
          wageTier: "Significant",
          seasons: 3,
          rolePromise: "Star Player",
        });
      }
    }
    return actions;
  },
};

export const CALCULATOR: Persona = {
  name: "The Calculator",
  tagline: "Financially prudent — never spends more than 1/10 of cash",
  decide(ctx) {
    const actions: Action[] = [];
    const cap = ctx.club.cashCents / 10;
    const target = pickBestTarget(
      ctx.marketListings,
      (l) => l.askingPriceCents <= cap,
    );
    if (target) {
      actions.push({
        kind: "bid",
        playerId: target.playerId,
        feeTier: tierForPrice(target.askingPriceCents),
        wageTier: "Modest",
        rolePromise: "Rotation",
      });
    }
    return actions;
  },
};

export const HOARDER: Persona = {
  name: "The Hoarder",
  tagline: "Collects depth — signs third-string players on long contracts",
  decide(ctx) {
    const actions: Action[] = [];
    if (ctx.club.squadSize < 25) {
      const target = pickBestTarget(
        ctx.marketListings,
        (l) => l.askingPriceCents <= ctx.club.cashCents / 4,
      );
      if (target) {
        actions.push({
          kind: "bid",
          playerId: target.playerId,
          feeTier: tierForPrice(target.askingPriceCents),
          wageTier: "Modest",
          rolePromise: "Backup",
        });
      }
    }
    return actions;
  },
};

export const SABOTEUR: Persona = {
  name: "The Saboteur",
  tagline: "Poaches from rivals — bids on high-badge players from top clubs",
  decide(ctx) {
    const actions: Action[] = [];
    const target = pickBestTarget(
      ctx.marketListings,
      (l) => l.badgeCount >= 2 && l.askingPriceCents <= ctx.club.cashCents,
    );
    if (target) {
      actions.push({
        kind: "bid",
        playerId: target.playerId,
        feeTier: tierForPrice(target.askingPriceCents),
        wageTier: "Significant",
        rolePromise: "Star Player",
      });
    }
    return actions;
  },
};

export const ROTATOR: Persona = {
  name: "The Rotator",
  tagline: "Mid-tier shopping — targets Rotation-quality players",
  decide(ctx) {
    const actions: Action[] = [];
    const target = pickBestTarget(
      ctx.marketListings,
      (l) =>
        l.age >= 24 && l.age <= 28 && l.askingPriceCents <= ctx.club.cashCents / 3,
    );
    if (target) {
      actions.push({
        kind: "bid",
        playerId: target.playerId,
        feeTier: tierForPrice(target.askingPriceCents),
        wageTier: "Notable",
        rolePromise: "Rotation",
      });
    }
    return actions;
  },
};

export const MINIMALIST: Persona = {
  name: "The Minimalist",
  tagline: "Control persona — does nothing, runs on autopilot",
  decide() {
    return [];
  },
};

export const PERSONA_ROSTER: readonly Persona[] = [
  MARQUEE,
  ANALYST,
  ARCHITECT,
  TRADITIONALIST,
  OPPORTUNIST,
  CALCULATOR,
  HOARDER,
  SABOTEUR,
  ROTATOR,
  MINIMALIST,
];

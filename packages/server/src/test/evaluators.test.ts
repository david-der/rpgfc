// Story 04 AC-07..10 — bid evaluator unit tests.
import { describe, expect, it } from "vitest";

import {
  evaluatePlayerProposal,
  evaluateSellerProposal,
} from "../application/transfers/evaluators.js";

describe("seller evaluator — Story 04 AC-07/08", () => {
  const baseBuyerBudget = {
    buyerCashReserveCents: 100_000_000_000,
    buyerWageBudgetCentsPerWeek: 100_000_000,
    buyerCurrentWageOutCents: 0,
  };

  it("AC-07: rejects a fee ≥30% below asking", () => {
    const result = evaluateSellerProposal({
      feeCents: 60_000_000_00, // $60M
      wageCents: 1_000_000, // $10k/week
      askingCents: 100_000_000_00, // $100M asking
      ...baseBuyerBudget,
    });
    expect(result.kind).toBe("reject");
    if (result.kind === "reject") {
      expect(result.reason).toBe("SELLER_FEE_TOO_LOW");
    }
  });

  it("AC-08: counters a fee 20% below asking at the midpoint", () => {
    const result = evaluateSellerProposal({
      feeCents: 80_000_000_00,
      wageCents: 1_000_000,
      askingCents: 100_000_000_00,
      ...baseBuyerBudget,
    });
    expect(result.kind).toBe("counter");
    if (result.kind === "counter") {
      // Midpoint = ($80M + $100M) / 2 = $90M
      expect(result.counterFeeCents).toBe(90_000_000_00);
    }
  });

  it("accepts a fee within 10% of asking", () => {
    const result = evaluateSellerProposal({
      feeCents: 95_000_000_00,
      wageCents: 1_000_000,
      askingCents: 100_000_000_00,
      ...baseBuyerBudget,
    });
    expect(result.kind).toBe("accept");
  });

  it("rejects on budget strain when the buyer cannot afford the wage", () => {
    const result = evaluateSellerProposal({
      feeCents: 100_000_000_00,
      wageCents: 1_000_000_000, // $10M/week
      askingCents: 100_000_000_00,
      buyerCashReserveCents: 10_000_000_000_00,
      buyerWageBudgetCentsPerWeek: 5_000_000, // $50k/week budget
      buyerCurrentWageOutCents: 0,
    });
    expect(result.kind).toBe("reject");
    if (result.kind === "reject") {
      expect(result.reason).toBe("SELLER_BUDGET_STRAIN");
    }
  });
});

describe("player evaluator — Story 04 AC-09/10", () => {
  const basePreferences = {
    wageFloorCents: 1_000_000,
    minPlayingTime: "Rotation" as const,
    preferredRegions: ["ES", "NL"],
    forbiddenClubIds: [7],
  };

  it("AC-09: rejects when wage < wage floor", () => {
    const result = evaluatePlayerProposal({
      wageCents: 500_000,
      rolePromise: "Important Player",
      toClubId: 1,
      toClubNationality: "ES",
      preferences: basePreferences,
    });
    expect(result.kind).toBe("reject");
    if (result.kind === "reject") {
      expect(result.reason).toBe("PLAYER_WAGE_FLOOR");
    }
  });

  it("AC-10: rejects when toClubId is in forbidden list", () => {
    const result = evaluatePlayerProposal({
      wageCents: 2_000_000,
      rolePromise: "Star Player",
      toClubId: 7,
      toClubNationality: "ES",
      preferences: basePreferences,
    });
    expect(result.kind).toBe("reject");
    if (result.kind === "reject") {
      expect(result.reason).toBe("PLAYER_FORBIDDEN_CLUB");
    }
  });

  it("rejects when playing-time role is weaker than minimum", () => {
    const result = evaluatePlayerProposal({
      wageCents: 2_000_000,
      rolePromise: "Backup",
      toClubId: 1,
      toClubNationality: "ES",
      preferences: basePreferences,
    });
    expect(result.kind).toBe("reject");
    if (result.kind === "reject") {
      expect(result.reason).toBe("PLAYER_PLAYING_TIME");
    }
  });

  it("rejects when region does not match preferred set", () => {
    const result = evaluatePlayerProposal({
      wageCents: 2_000_000,
      rolePromise: "Star Player",
      toClubId: 1,
      toClubNationality: "BR",
      preferences: basePreferences,
    });
    expect(result.kind).toBe("reject");
    if (result.kind === "reject") {
      expect(result.reason).toBe("PLAYER_REGION_MISMATCH");
    }
  });

  it("accepts when all four checks pass", () => {
    const result = evaluatePlayerProposal({
      wageCents: 2_000_000,
      rolePromise: "Star Player",
      toClubId: 1,
      toClubNationality: "ES",
      preferences: basePreferences,
    });
    expect(result.kind).toBe("accept");
  });
});

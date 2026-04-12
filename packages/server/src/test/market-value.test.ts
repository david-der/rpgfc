// Story 08 AC-01: market value is a pure function that changes with form.

import { describe, expect, it } from "vitest";

import { computeMarketValue } from "../application/transfers/market-value.js";

describe("computeMarketValue — Story 08", () => {
  it("peak-age striker with good form is more valuable than poor form", () => {
    const good = computeMarketValue({
      positionLabel: "ST",
      age: 25,
      formTier: "Good",
      badgeCount: 3,
      contractSeasonsRemaining: 3,
    });
    const poor = computeMarketValue({
      positionLabel: "ST",
      age: 25,
      formTier: "Poor",
      badgeCount: 3,
      contractSeasonsRemaining: 3,
    });
    expect(good.cents).toBeGreaterThan(poor.cents);
  });

  it("young player is cheaper than peak-age player", () => {
    const young = computeMarketValue({
      positionLabel: "CM",
      age: 18,
      formTier: "Average",
      badgeCount: 1,
      contractSeasonsRemaining: 3,
    });
    const peak = computeMarketValue({
      positionLabel: "CM",
      age: 26,
      formTier: "Average",
      badgeCount: 1,
      contractSeasonsRemaining: 3,
    });
    expect(young.cents).toBeLessThan(peak.cents);
  });

  it("expiring contract lowers value", () => {
    const locked = computeMarketValue({
      positionLabel: "CB",
      age: 27,
      formTier: "Average",
      badgeCount: 2,
      contractSeasonsRemaining: 3,
    });
    const expiring = computeMarketValue({
      positionLabel: "CB",
      age: 27,
      formTier: "Average",
      badgeCount: 2,
      contractSeasonsRemaining: 1,
    });
    expect(expiring.cents).toBeLessThan(locked.cents);
  });

  it("more badges increase value", () => {
    const few = computeMarketValue({
      positionLabel: "LW",
      age: 24,
      formTier: "Average",
      badgeCount: 0,
      contractSeasonsRemaining: 2,
    });
    const many = computeMarketValue({
      positionLabel: "LW",
      age: 24,
      formTier: "Average",
      badgeCount: 8,
      contractSeasonsRemaining: 2,
    });
    expect(many.cents).toBeGreaterThan(few.cents);
  });

  it("returns a valid CurrencyTier", () => {
    const result = computeMarketValue({
      positionLabel: "GK",
      age: 30,
      formTier: "Average",
      badgeCount: 1,
      contractSeasonsRemaining: 2,
    });
    expect(["Minimal", "Modest", "Notable", "Significant", "Elite"]).toContain(result.tier);
  });

  it("free agent (no contract) is cheapest", () => {
    const free = computeMarketValue({
      positionLabel: "ST",
      age: 25,
      formTier: "Good",
      badgeCount: 3,
      contractSeasonsRemaining: null,
    });
    const contracted = computeMarketValue({
      positionLabel: "ST",
      age: 25,
      formTier: "Good",
      badgeCount: 3,
      contractSeasonsRemaining: 3,
    });
    expect(free.cents).toBeLessThan(contracted.cents);
  });
});

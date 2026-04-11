// AC-05, AC-06: moodFor is total over (PlayingTimeRole, SquadRole) and
// harmonyFor is min-of-mood.
//
// This test pins the intended semantics of every cell in the 5×4 promise
// × squad-role matrix. If Story 06+ changes the meaning of any cell, the
// update should be deliberate enough to flip these assertions.

import { describe, expect, it } from "vitest";

import type { PlayingTimeRole, PromiseMood, SquadRole } from "@rpgfc/shared";

import { harmonyFor, moodFor } from "../application/squad/harmony.js";

describe("moodFor — full (promise, role) matrix (AC-05)", () => {
  // (promise, role) → expected mood. A "-" means the cell is semantically
  // unusual but still must return a defined PromiseMood.
  const table: Array<[PlayingTimeRole | null, SquadRole, PromiseMood]> = [
    // Star Player (maps to Starter)
    ["Star Player", "Starter", "Content"],
    ["Star Player", "Rotation", "Concerned"],
    ["Star Player", "Backup", "Disappointed"],
    ["Star Player", "Youth", "Furious"],
    // Important Player (also maps to Starter)
    ["Important Player", "Starter", "Content"],
    ["Important Player", "Rotation", "Concerned"],
    ["Important Player", "Backup", "Disappointed"],
    ["Important Player", "Youth", "Furious"],
    // Rotation
    ["Rotation", "Starter", "Eager"],
    ["Rotation", "Rotation", "Content"],
    ["Rotation", "Backup", "Concerned"],
    ["Rotation", "Youth", "Disappointed"],
    // Backup
    ["Backup", "Starter", "Eager"],
    ["Backup", "Rotation", "Eager"],
    ["Backup", "Backup", "Content"],
    ["Backup", "Youth", "Concerned"],
    // Youth/Development
    ["Youth/Development", "Starter", "Eager"],
    ["Youth/Development", "Rotation", "Eager"],
    ["Youth/Development", "Backup", "Eager"],
    ["Youth/Development", "Youth", "Content"],
    // No contract → always Content (neutral)
    [null, "Starter", "Content"],
    [null, "Rotation", "Content"],
    [null, "Backup", "Content"],
    [null, "Youth", "Content"],
  ];

  for (const [promise, role, expected] of table) {
    it(`${promise ?? "no-contract"} × ${role} → ${expected}`, () => {
      expect(moodFor(promise, role)).toBe(expected);
    });
  }
});

describe("harmonyFor — min-of-mood aggregate (AC-06)", () => {
  it("empty squad is Settled", () => {
    expect(harmonyFor([])).toBe("Settled");
  });

  it("all Content is Settled", () => {
    expect(harmonyFor(["Content", "Content", "Content"])).toBe("Settled");
  });

  it("any Eager (and no complaints) is Harmonious", () => {
    expect(harmonyFor(["Content", "Eager", "Content"])).toBe("Harmonious");
  });

  it("any Concerned drops to Uneasy", () => {
    expect(harmonyFor(["Eager", "Content", "Concerned"])).toBe("Uneasy");
  });

  it("any Disappointed drops to Fractured", () => {
    expect(harmonyFor(["Content", "Disappointed", "Eager"])).toBe("Fractured");
  });

  it("a single Furious tanks the whole squad to InRevolt", () => {
    expect(harmonyFor(["Eager", "Eager", "Content", "Furious"])).toBe("InRevolt");
  });
});

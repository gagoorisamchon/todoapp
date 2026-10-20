import { describe, expect, it } from "vitest";
import { goalPercent, toPercent, weeklyPercent, weeklyRaw } from "@/lib/progress";

describe("weekly progress", () => {
  it("weeklyRaw returns 0 for empty plans", () => {
    expect(weeklyRaw({ total: 0, done: 0 })).toBe(0);
  });

  it.each([
    [0, 0, 0],
    [3, 3, 100],
    [3, 1, 33],
    [3, 2, 67],
    [8, 1, 13],
  ])("total %i done %i -> %i%%", (total, done, pct) => {
    expect(weeklyPercent({ total, done })).toBe(pct);
  });

  it("toPercent rounds", () => {
    expect(toPercent(12.5)).toBe(13);
    expect(toPercent(33.4)).toBe(33);
  });
});

describe("goalPercent (R6: mean of raw, rounded once)", () => {
  it("empty -> 0", () => expect(goalPercent([])).toBe(0));
  it("[12.5, 0] -> 6, not 7", () => expect(goalPercent([12.5, 0])).toBe(6));
  it("[12.5, 0, 100] -> 38", () => expect(goalPercent([12.5, 0, 100])).toBe(38));
  it("[100/3, 200/3] -> 50", () => expect(goalPercent([100 / 3, 200 / 3])).toBe(50));
});

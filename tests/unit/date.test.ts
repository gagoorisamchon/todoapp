import { describe, expect, it } from "vitest";
import {
  addDaysKey,
  addYearsKey,
  isMonday,
  isValidDateKey,
  isWithin,
  mondayOf,
  todayKey,
  weekEnd,
  yearOf,
} from "@/lib/date";

describe("todayKey (R10 Asia/Seoul)", () => {
  it.each([
    ["2026-10-19T15:30:00Z", "2026-10-20"],
    ["2026-10-20T14:59:00Z", "2026-10-20"],
    ["2026-10-20T15:00:00Z", "2026-10-21"],
  ])("%s -> %s", (iso, expected) => {
    expect(todayKey(new Date(iso))).toBe(expected);
  });

  it("defaults to the current time", () => {
    expect(todayKey()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("isValidDateKey", () => {
  it.each([
    ["2026-02-28", true],
    ["2028-02-29", true],
    ["2026-02-30", false],
    ["2026-13-01", false],
    ["2026-1-01", false],
    ["2026-00-10", false],
    ["abc", false],
    ["", false],
  ])("%s -> %s", (s, expected) => {
    expect(isValidDateKey(s)).toBe(expected);
  });
});

describe("week helpers", () => {
  it("isMonday", () => {
    expect(isMonday("2026-10-19")).toBe(true);
    expect(isMonday("2026-10-20")).toBe(false);
    expect(isMonday("2026-10-25")).toBe(false);
  });

  it("weekEnd = start + 6 days", () => {
    expect(weekEnd("2026-10-19")).toBe("2026-10-25");
    expect(weekEnd("2026-12-28")).toBe("2027-01-03");
  });

  it("mondayOf", () => {
    expect(mondayOf("2026-10-25")).toBe("2026-10-19");
    expect(mondayOf("2026-10-19")).toBe("2026-10-19");
    expect(mondayOf("2026-10-21")).toBe("2026-10-19");
    expect(mondayOf("2027-01-01")).toBe("2026-12-28");
  });
});

describe("addYearsKey", () => {
  it("keeps month/day and clamps Feb 29", () => {
    expect(addYearsKey("2026-10-20", 1)).toBe("2027-10-20");
    expect(addYearsKey("2026-10-20", -1)).toBe("2025-10-20");
    expect(addYearsKey("2028-02-29", 1)).toBe("2029-02-28");
    expect(addYearsKey("2027-02-28", 1)).toBe("2028-02-28");
  });
});

describe("addDaysKey", () => {
  it("handles positive, negative, zero and boundary crossings", () => {
    expect(addDaysKey("2026-10-19", 0)).toBe("2026-10-19");
    expect(addDaysKey("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDaysKey("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysKey("2027-01-01", -1)).toBe("2026-12-31");
    expect(addDaysKey("2028-03-01", -1)).toBe("2028-02-29");
  });
});

describe("isWithin (inclusive)", () => {
  const start = "2026-10-19";
  const end = "2026-10-25";
  it("includes both ends and excludes outside", () => {
    expect(isWithin("2026-10-19", start, end)).toBe(true);
    expect(isWithin("2026-10-22", start, end)).toBe(true);
    expect(isWithin("2026-10-25", start, end)).toBe(true);
    expect(isWithin("2026-10-18", start, end)).toBe(false);
    expect(isWithin("2026-10-26", start, end)).toBe(false);
  });
});

describe("yearOf", () => {
  it("returns a number", () => {
    expect(yearOf("2026-10-19")).toBe(2026);
  });
});

describe("machine TZ independence", () => {
  it("key-only functions give the same result under different process.env.TZ", () => {
    const original = process.env.TZ;
    const run = () => [
      isMonday("2026-10-19"),
      mondayOf("2026-10-25"),
      weekEnd("2026-12-28"),
      addDaysKey("2026-03-28", 2),
      addDaysKey("2026-11-01", -1),
      isValidDateKey("2026-02-28"),
    ];
    try {
      process.env.TZ = "Pacific/Honolulu";
      const a = run();
      process.env.TZ = "Asia/Seoul";
      const b = run();
      process.env.TZ = "Pacific/Kiritimati";
      const c = run();
      expect(b).toEqual(a);
      expect(c).toEqual(a);
    } finally {
      if (original === undefined) delete process.env.TZ;
      else process.env.TZ = original;
    }
  });
});

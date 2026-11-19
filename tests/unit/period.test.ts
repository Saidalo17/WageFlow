import { describe, expect, it } from "vitest";
import {
  addDays,
  analyticsBounds,
  capAtTomorrow,
  comparisonBounds,
  currentPeriod,
  daysBetween,
  eachDay,
  eachMonth,
  isRealDate,
  lastMonths,
  parseCustomRange,
  percentChange,
  rangeBounds,
} from "@/lib/period";

// Thursday, 19 November 2026
const NOW = new Date(2026, 10, 19);

describe("the month the user sees", () => {
  it("is the calendar month by default", () => {
    expect(currentPeriod(1, NOW)).toEqual({ from: "2026-11-01", to: "2026-11-30" });
  });

  it("can start on another day", () => {
    expect(currentPeriod(15, NOW)).toEqual({ from: "2026-11-15", to: "2026-12-14" });
    // before the 25th the period is still the one that began last month
    expect(currentPeriod(25, NOW)).toEqual({ from: "2026-10-25", to: "2026-11-24" });
  });

  it("handles year ends and short months", () => {
    expect(currentPeriod(1, new Date(2026, 11, 31))).toEqual({ from: "2026-12-01", to: "2026-12-31" });
    expect(currentPeriod(1, new Date(2028, 1, 10))).toEqual({ from: "2028-02-01", to: "2028-02-29" }); // leap year
    expect(currentPeriod(28, new Date(2027, 0, 5))).toEqual({ from: "2026-12-28", to: "2027-01-27" });
  });
});

describe("named ranges", () => {
  it("month, previous month, quarter and year", () => {
    expect(rangeBounds("month", 1, NOW)).toEqual({ from: "2026-11-01", to: "2026-11-30" });
    expect(rangeBounds("prev", 1, NOW)).toEqual({ from: "2026-10-01", to: "2026-10-31" });
    expect(rangeBounds("quarter", 1, NOW)).toEqual({ from: "2026-09-01", to: "2026-11-30" });
    expect(rangeBounds("year", 1, NOW)).toEqual({ from: "2025-12-01", to: "2026-11-30" });
    expect(rangeBounds("all", 1, NOW)).toEqual({});
  });

  it("last 7 days includes today", () => {
    expect(analyticsBounds("week", 1, null, NOW)).toEqual({ from: "2026-11-13", to: "2026-11-19" });
  });

  it("uses a valid custom range and ignores an invalid one", () => {
    const custom = { from: "2026-01-01", to: "2026-03-31" };
    expect(analyticsBounds("custom", 1, custom, NOW)).toEqual(custom);
    expect(analyticsBounds("custom", 1, null, NOW)).toEqual({ from: "2026-11-01", to: "2026-11-30" });
  });
});

describe("comparison with the previous period", () => {
  it("compares this month so far with the same days of last month", () => {
    const b = analyticsBounds("month", 1, null, NOW);
    expect(comparisonBounds("month", b, 1, NOW)).toEqual({ from: "2026-10-01", to: "2026-10-19" });
  });

  it("compares a finished month with the month before it", () => {
    const b = analyticsBounds("prev", 1, null, NOW);
    expect(comparisonBounds("prev", b, 1, NOW)).toEqual({ from: "2026-09-01", to: "2026-09-30" });
  });

  it("uses an equal-length window right before the period for other ranges", () => {
    const week = analyticsBounds("week", 1, null, NOW);
    expect(comparisonBounds("week", week, 1, NOW)).toEqual({ from: "2026-11-06", to: "2026-11-12" });
    const custom = { from: "2026-03-01", to: "2026-03-10" };
    expect(comparisonBounds("custom", custom, 1, NOW)).toEqual({ from: "2026-02-19", to: "2026-02-28" });
  });

  it("percent change, and nothing to compare with when the old value is zero", () => {
    expect(percentChange(150, 100)).toBe(0.5);
    expect(percentChange(50, 100)).toBe(-0.5);
    expect(percentChange(0, 100)).toBe(-1);
    expect(percentChange(5, 0)).toBeNull();
    expect(percentChange(0, 0)).toBeNull();
  });
});

describe("date helpers", () => {
  it("counts days inclusively", () => {
    expect(daysBetween("2026-11-01", "2026-11-19")).toBe(19);
    expect(daysBetween("2026-11-19", "2026-11-19")).toBe(1);
  });

  it("adds days across month and year borders", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("lists every day and every month in a range", () => {
    expect(eachDay("2026-02-27", "2026-03-02")).toEqual(["2026-02-27", "2026-02-28", "2026-03-01", "2026-03-02"]);
    expect(eachMonth("2025-11-15", "2026-02-01")).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
  });

  it("validates real dates only", () => {
    expect(isRealDate("2026-02-28")).toBe(true);
    expect(isRealDate("2026-02-30")).toBe(false);
    expect(isRealDate("2024-02-29")).toBe(true);
    expect(isRealDate("2026-13-01")).toBe(false);
    expect(isRealDate("26-01-01")).toBe(false);
    expect(isRealDate("nonsense")).toBe(false);
  });

  it("validates custom ranges", () => {
    expect(parseCustomRange("2026-01-01", "2026-03-31")).toEqual({ from: "2026-01-01", to: "2026-03-31" });
    expect(parseCustomRange("2026-04-10", "2026-04-01")).toBeNull();
    expect(parseCustomRange("2026-02-30", "2026-03-01")).toBeNull();
    expect(parseCustomRange("2015-01-01", "2026-03-01")).toBeNull(); // longer than 5 years
    expect(parseCustomRange(undefined, "2026-03-01")).toBeNull();
  });

  it("cuts an unfinished period at tomorrow and leaves finished ones alone", () => {
    expect(capAtTomorrow("2026-11-30", NOW)).toBe("2026-11-20");
    expect(capAtTomorrow("2026-10-31", NOW)).toBe("2026-10-31");
  });

  it("last N months", () => {
    expect(lastMonths(6, NOW)).toEqual({ from: "2026-06-01", to: "2026-11-20" });
    expect(lastMonths(12, NOW).from).toBe("2025-12-01");
  });
});

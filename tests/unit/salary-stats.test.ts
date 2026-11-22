import { describe, expect, it } from "vitest";
import {
  buildSeries,
  compareWithPreviousMonth,
  forecast,
  growth,
  monthKeys,
  yearStats,
  type MonthTotals,
} from "@/lib/salary-stats";

const NOW = new Date(2026, 10, 22); // 22 Nov 2026

const m = (month: string, net: number, extra: Partial<MonthTotals> = {}): MonthTotals => ({
  month,
  gross: Math.round(net * 1.25),
  net,
  bonus: 0,
  deductions: Math.round(net * 0.25),
  overtime: 0,
  count: 1,
  ...extra,
});

describe("monthKeys", () => {
  it("lists months ending with the current one, across a year boundary", () => {
    expect(monthKeys(3, new Date(2026, 0, 15))).toEqual(["2025-11", "2025-12", "2026-01"]);
  });
  it("can be shifted back", () => {
    expect(monthKeys(2, NOW, 2)).toEqual(["2026-08", "2026-09"]);
  });
});

describe("buildSeries", () => {
  it("fills months without pay with zeros", () => {
    const s = buildSeries([m("2026-10", 1000)], ["2026-09", "2026-10"]);
    expect(s[0]).toMatchObject({ month: "2026-09", net: 0, count: 0 });
    expect(s[1].net).toBe(1000);
  });
});

describe("compareWithPreviousMonth", () => {
  it("gives the change against last month", () => {
    const r = compareWithPreviousMonth([m("2026-10", 100000), m("2026-11", 110000)], NOW);
    expect(r.net).toBeCloseTo(0.1);
  });
  it("is null when last month had no pay", () => {
    expect(compareWithPreviousMonth([m("2026-11", 110000)], NOW).net).toBeNull();
  });
});

describe("yearStats", () => {
  it("adds up the last 12 months and finds the best month", () => {
    const s = yearStats(
      [m("2026-09", 100000, { bonus: 5000, overtime: 2000 }), m("2026-10", 300000), m("2026-11", 200000), m("2025-01", 999999)],
      NOW,
    );
    expect(s.net).toBe(600000); // January 2025 is outside the window
    expect(s.bonus).toBe(5000);
    expect(s.monthsWithPay).toBe(3);
    expect(s.averageNet).toBe(200000);
    expect(s.best?.month).toBe("2026-10");
    expect(s.deductionRate).toBeCloseTo(0.2); // 25% of net = 20% of gross
  });
  it("is all zero without data", () => {
    const s = yearStats([], NOW);
    expect(s).toMatchObject({ net: 0, monthsWithPay: 0, averageNet: 0, best: null, deductionRate: 0 });
  });
});

describe("growth", () => {
  it("compares the last 3 months with the 3 before", () => {
    const g = growth(
      [m("2026-06", 100000), m("2026-07", 100000), m("2026-08", 100000), m("2026-09", 120000), m("2026-10", 120000), m("2026-11", 120000)],
      NOW,
    );
    expect(g.recent).toBeCloseTo(0.2);
  });
  it("compares a year with the year before", () => {
    const g = growth([m("2025-06", 100000), m("2026-11", 150000)], NOW);
    expect(g.yearly).toBeCloseTo(0.5);
  });
  it("is null when there is nothing to compare with", () => {
    expect(growth([m("2026-11", 100000)], NOW)).toEqual({ recent: null, yearly: null });
  });
});

describe("forecast", () => {
  it("needs at least 3 months with pay", () => {
    expect(forecast([m("2026-10", 100000), m("2026-11", 100000)], NOW)).toBeNull();
  });
  it("continues a steady rise", () => {
    const f = forecast([m("2026-08", 100000), m("2026-09", 110000), m("2026-10", 120000), m("2026-11", 130000)], NOW)!;
    expect(f.months.map((x) => x.month)).toEqual(["2026-12", "2027-01", "2027-02"]);
    expect(f.months.map((x) => x.net)).toEqual([140000, 150000, 160000]);
    expect(f.slope).toBe(10000);
    expect(f.basedOn).toBe(4);
  });
  it("stays flat for a flat salary and never goes below zero", () => {
    const flat = forecast([m("2026-09", 100000), m("2026-10", 100000), m("2026-11", 100000)], NOW)!;
    expect(flat.months.every((x) => x.net === 100000)).toBe(true);
    expect(flat.yearEstimate).toBe(1200000);
    const falling = forecast([m("2026-09", 30000), m("2026-10", 20000), m("2026-11", 10000)], NOW)!;
    expect(falling.months.map((x) => x.net)).toEqual([0, 0, 0]);
  });
});

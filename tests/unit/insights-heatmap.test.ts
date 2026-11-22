import { describe, expect, it } from "vitest";
import { buildHeatmap, heatmapStart, levelFor } from "@/lib/heatmap";
import { buildInsights, type InsightInput } from "@/lib/insights";

const base: InsightInput = { income: 0, expense: 0, previousExpense: 0, categories: [], budgets: [] };

describe("buildInsights", () => {
  it("says nothing without data", () => {
    expect(buildInsights(base)).toEqual([]);
  });

  it("savings: good from 20%, low below, a warning when more is spent than earned", () => {
    expect(buildInsights({ ...base, income: 1000, expense: 600 })[0]).toMatchObject({ key: "savingsGood", tone: "good" });
    expect(buildInsights({ ...base, income: 1000, expense: 900 })[0]).toMatchObject({ key: "savingsLow", tone: "info" });
    const over = buildInsights({ ...base, income: 1000, expense: 1300 })[0];
    expect(over).toMatchObject({ key: "overspent", tone: "warn", values: { amount: 300 } });
  });

  it("spending against the previous period only speaks up for a change of 15% or more", () => {
    const keys = (prev: number, now: number) => buildInsights({ ...base, previousExpense: prev, expense: now }).map((i) => i.key);
    expect(keys(1000, 1200)).toEqual(["spendUp"]);
    expect(keys(1000, 700)).toEqual(["spendDown"]);
    expect(keys(1000, 1100)).toEqual([]);
    expect(keys(0, 500)).toEqual([]);
  });

  it("names a category that takes 30% or more of the spending", () => {
    const i = buildInsights({ ...base, expense: 1000, categories: [{ name: "Food", total: 450 }, { name: "Taxi", total: 100 }] });
    expect(i[0]).toMatchObject({ key: "topCategory", values: { name: "Food", percent: 0.45 } });
    expect(buildInsights({ ...base, expense: 1000, categories: [{ name: "Food", total: 250 }] })).toEqual([]);
  });

  it("warns about the budget closest to its limit, over before near", () => {
    const over = buildInsights({ ...base, budgets: [{ name: "Fun", spent: 150, limit: 100 }, { name: "Food", spent: 90, limit: 100 }] });
    expect(over).toEqual([{ key: "budgetOver", tone: "warn", values: { name: "Fun" } }]);
    const near = buildInsights({ ...base, budgets: [{ name: "Food", spent: 85, limit: 100 }, { name: "Fun", spent: 10, limit: 100 }] });
    expect(near[0]).toMatchObject({ key: "budgetNear", values: { name: "Food" } });
    expect(buildInsights({ ...base, budgets: [{ name: "Food", spent: 10, limit: 100 }] })).toEqual([]);
  });

  it("puts warnings first and shows at most four lines", () => {
    const i = buildInsights({
      income: 1000, expense: 1200, previousExpense: 800,
      categories: [{ name: "Food", total: 700 }],
      budgets: [{ name: "Food", spent: 700, limit: 500 }],
    });
    expect(i.length).toBeLessThanOrEqual(4);
    expect(i[0].tone).toBe("warn");
    expect(i.map((x) => x.key)).toContain("overspent");
  });
});

describe("heatmap", () => {
  // Sunday 22 Nov 2026
  const today = "2026-11-22";

  it("starts on a Monday, 13 weeks back", () => {
    expect(heatmapStart(today, 13)).toBe("2026-08-24");
    expect(new Date("2026-08-24T00:00:00Z").getUTCDay()).toBe(1);
  });

  it("builds weeks of seven days, Monday first", () => {
    const h = buildHeatmap([], today, 13);
    expect(h.columns).toHaveLength(13);
    expect(h.columns.every((c) => c.length === 7)).toBe(true);
    expect(h.columns[0][0].date).toBe("2026-08-24");
    expect(h.columns[12][6].date).toBe("2026-11-22"); // today is a Sunday: the last cell
  });

  it("days after today are out of range", () => {
    const h = buildHeatmap([], "2026-11-18", 2); // a Wednesday
    const last = h.columns[1];
    expect(last.filter((c) => c.inRange)).toHaveLength(3); // Mon, Tue, Wed
    expect(last[3].inRange).toBe(false);
  });

  it("darkness follows the quartiles of the days with spending", () => {
    const spending = [10, 20, 30, 40, 50, 60, 70, 80].map((v, i) => ({ date: `2026-11-${String(i + 10).padStart(2, "0")}`, expense: v }));
    const h = buildHeatmap(spending, today, 3);
    const cells = h.columns.flat();
    const level = (d: string) => cells.find((c) => c.date === d)!.level;
    expect(level("2026-11-10")).toBe(1);
    expect(level("2026-11-17")).toBe(4);
    expect(level("2026-11-09")).toBe(0);
    expect(h.max).toBe(80);
    expect(h.total).toBe(360);
  });

  it("levelFor: zero is empty, thresholds are inclusive", () => {
    expect(levelFor(0, [10, 20, 30])).toBe(0);
    expect(levelFor(10, [10, 20, 30])).toBe(1);
    expect(levelFor(11, [10, 20, 30])).toBe(2);
    expect(levelFor(31, [10, 20, 30])).toBe(4);
  });
});

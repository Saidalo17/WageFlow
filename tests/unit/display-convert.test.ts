import { describe, expect, it } from "vitest";
import { convertBudgets, convertSeries, convertTotals, convertTotalsBy, convertTransactions } from "@/lib/display-convert";
import { minorMultiplier } from "@/lib/fx";

// 1 USD = 0.5 EUR, shown in euro: every amount is halved (both have 2 decimals)
const eur = { convert: (m: number) => Math.round(m * minorMultiplier("USD", "EUR", 0.5)) };
// 1 USD = 150 JPY: cents become whole yen
const jpy = { convert: (m: number) => Math.round(m * minorMultiplier("USD", "JPY", 150)) };

describe("showing amounts in another currency", () => {
  it("converts totals, chart points, category totals, limits and transactions", () => {
    expect(convertTotals(eur, { income: 100000, expense: 4500 })).toEqual({ income: 50000, expense: 2250 });
    expect(convertSeries(eur, [{ date: "2026-11-01", income: 1000, expense: 200 }])).toEqual([
      { date: "2026-11-01", income: 500, expense: 100 },
    ]);
    expect(convertTotalsBy(eur, [{ name: "Food", total: 1250 }])).toEqual([{ name: "Food", total: 625 }]);
    expect(convertBudgets(eur, [{ limit: 10000, spent: 2500 }])).toEqual([{ limit: 5000, spent: 1250 }]);
    expect(convertTransactions(eur, [{ amount: 3000, note: "x" }])).toEqual([{ amount: 1500, note: "x" }]);
  });
  it("accounts for different decimals (dollars have cents, yen do not)", () => {
    expect(jpy.convert(1000)).toBe(1500); // $10.00 -> ¥1500
    expect(jpy.convert(0)).toBe(0);
  });
  it("keeps percentages and ratios the same (the conversion is linear)", () => {
    const [b] = convertBudgets(jpy, [{ limit: 20000, spent: 5000 }]);
    expect(b.spent / b.limit).toBeCloseTo(0.25);
  });
});

import { describe, expect, it } from "vitest";
import { nextPaymentDate, openAmounts, payoff, progress, remaining } from "@/lib/debts";
import { computeNetWorth, sortItems, trend, type WorthItem } from "@/lib/net-worth";

describe("debt maths", () => {
  it("remaining and progress never go out of range", () => {
    expect(remaining(100_000, 30_000)).toBe(70_000);
    expect(remaining(100_000, 130_000)).toBe(0);
    expect(progress(100_000, 25_000)).toBe(0.25);
    expect(progress(100_000, 500_000)).toBe(1);
    expect(progress(0, 10)).toBe(0);
  });

  describe("payoff", () => {
    it("without interest: left divided by the payment, rounded up", () => {
      expect(payoff(100_000, 0, 30_000)).toEqual({ months: 4, interest: 0 });
      expect(payoff(90_000, 0, 30_000)).toEqual({ months: 3, interest: 0 });
    });
    it("with interest: takes longer and the interest is counted", () => {
      // 10 000.00 at 12% a year, 1 000.00 a month: about 11 months
      const p = payoff(1_000_000, 1200, 100_000)!;
      expect(p.months).toBe(11);
      expect(p.interest).toBeGreaterThan(50_000);
      expect(p.interest).toBeLessThan(70_000);
    });
    it("says null when there is nothing to estimate or the payment does not cover the interest", () => {
      expect(payoff(0, 1200, 1000)).toBeNull();
      expect(payoff(100_000, 1200, null)).toBeNull();
      expect(payoff(100_000, 1200, 0)).toBeNull();
      // 12%/year on 1 000 000 is 10 000 a month; paying 9 000 never gets anywhere
      expect(payoff(1_000_000, 1200, 9_000)).toBeNull();
    });
  });

  describe("nextPaymentDate", () => {
    it("is this month when the day is still ahead (or today), otherwise next month", () => {
      expect(nextPaymentDate(25, "2026-11-22")).toBe("2026-11-25");
      expect(nextPaymentDate(22, "2026-11-22")).toBe("2026-11-22");
      expect(nextPaymentDate(5, "2026-11-22")).toBe("2026-12-05");
      expect(nextPaymentDate(5, "2026-12-22")).toBe("2027-01-05");
    });
    it("uses the last day of a shorter month", () => {
      expect(nextPaymentDate(31, "2027-02-10")).toBe("2027-02-28");
      expect(nextPaymentDate(31, "2028-02-10")).toBe("2028-02-29");
    });
    it("is null without a day", () => {
      expect(nextPaymentDate(null, "2026-11-22")).toBeNull();
    });
  });

  it("openAmounts leaves paid-off debts out", () => {
    const open = openAmounts([
      { direction: "owed_by_me", currency: "USD", principal: 1000, paid: 400 },
      { direction: "owed_by_me", currency: "USD", principal: 500, paid: 500 },
    ]);
    expect(open).toHaveLength(1);
    expect(open[0].left).toBe(600);
  });
});

describe("net worth", () => {
  const items: WorthItem[] = [
    { kind: "account", id: "a", name: "Cash", currency: "USD", amount: 100_000 }, // $1 000
    { kind: "account", id: "b", name: "Bank EUR", currency: "EUR", amount: 200_000 }, // €2 000
    { kind: "account", id: "c", name: "Credit card", currency: "USD", amount: -30_000 }, // owes $300 on the card
    { kind: "debt", id: "d", name: "Loan", currency: "USD", amount: -400_000 }, // owes $4 000
    { kind: "debt", id: "e", name: "Friend owes me", currency: "EUR", amount: 50_000 }, // €500 owed to me
  ];
  const convert = (minor: number, from: string) => (from === "EUR" ? Math.round(minor * 1.1) : minor);

  it("adds assets, subtracts liabilities, converts other currencies", () => {
    const nw = computeNetWorth(items, "USD", convert);
    expect(nw.assets).toBe(100_000 + 220_000 + 55_000);
    expect(nw.liabilities).toBe(30_000 + 400_000);
    expect(nw.netWorth).toBe(375_000 - 430_000);
    expect(nw.items.find((i) => i.id === "b")?.converted).toBe(220_000);
  });

  it("a negative account balance counts as a liability, not as a negative asset", () => {
    const nw = computeNetWorth([{ kind: "account", id: "x", name: "Card", currency: "USD", amount: -5_000 }], "USD", convert);
    expect(nw).toMatchObject({ assets: 0, liabilities: 5_000, netWorth: -5_000 });
  });

  it("does not convert items already in the target currency, and is empty without items", () => {
    let calls = 0;
    computeNetWorth([items[0]], "USD", (m) => (calls++, m));
    expect(calls).toBe(0);
    expect(computeNetWorth([], "USD", convert)).toMatchObject({ assets: 0, liabilities: 0, netWorth: 0 });
  });

  it("sorts accounts before debts, biggest first", () => {
    const nw = computeNetWorth(items, "USD", convert);
    // accounts by size (EUR 2 000 = 2 200, cash 1 000, card -300), then debts by size (loan 4 000, friend 550)
    expect(sortItems(nw.items).map((i) => i.id)).toEqual(["b", "a", "c", "d", "e"]);
  });

  it("trend compares the first and the last point", () => {
    expect(trend([{ netWorth: 100 }])).toBeNull();
    expect(trend([{ netWorth: 100 }, { netWorth: 150 }, { netWorth: 120 }])).toEqual({ change: 20, percent: 0.2 });
    expect(trend([{ netWorth: 0 }, { netWorth: 50 }])).toEqual({ change: 50, percent: null });
  });
});

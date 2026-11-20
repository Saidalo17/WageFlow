import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { convertMinor, getRate, minorMultiplier, rateFromTable, RatesUnavailableError } from "@/lib/fx";
import { dayPart } from "@/lib/day-part";

describe("converting amounts between currencies", () => {
  it("rescales for currencies with different decimals", () => {
    // 10.00 USD at 150 JPY per USD = 1500 JPY (no decimals)
    expect(convertMinor(1000, "USD", "JPY", 150)).toBe(1500);
    // 1500 JPY at 1/150 USD per JPY = 10.00 USD = 1000 cents
    expect(convertMinor(1500, "JPY", "USD", 1 / 150)).toBe(1000);
    // 10.00 USD at 0.3 KWD per USD = 3.000 KWD (three decimals)
    expect(convertMinor(1000, "USD", "KWD", 0.3)).toBe(3000);
  });
  it("rounds to the nearest minor unit and never gives zero", () => {
    expect(convertMinor(1, "USD", "EUR", 0.001)).toBe(1);
    expect(convertMinor(1001, "USD", "EUR", 0.5)).toBe(501); // 500.5 -> 501
  });
  it("leaves the amount alone for the same currency", () => {
    expect(convertMinor(1234, "EUR", "EUR", 99)).toBe(1234);
  });
  it("gives the multiplier used by the bulk SQL update", () => {
    expect(minorMultiplier("USD", "JPY", 150)).toBeCloseTo(1.5);
    expect(minorMultiplier("JPY", "USD", 1 / 150)).toBeCloseTo(100 / 150);
  });
});

describe("exchange rates", () => {
  const original = process.env.FX_FIXED_RATES;
  beforeEach(() => {
    process.env.FX_FIXED_RATES = JSON.stringify({ USD: 1, EUR: 0.5, JPY: 150 });
  });
  afterEach(() => {
    if (original === undefined) delete process.env.FX_FIXED_RATES;
    else process.env.FX_FIXED_RATES = original;
  });

  it("works out the cross rate through the dollar", async () => {
    expect(await getRate("USD", "EUR")).toBe(0.5);
    expect(await getRate("EUR", "USD")).toBe(2);
    expect(await getRate("EUR", "JPY", "2020-01-01")).toBe(300);
    expect(await getRate("EUR", "EUR")).toBe(1);
  });
  it("says so when a currency has no rate", async () => {
    await expect(getRate("USD", "XXX")).rejects.toBeInstanceOf(RatesUnavailableError);
    expect(() => rateFromTable({ usd: 1 }, "USD", "EUR")).toThrow(RatesUnavailableError);
  });
});

describe("greeting by the time of day", () => {
  it("picks the right part of the day for every hour", () => {
    const expected: Record<number, string> = {};
    for (let h = 0; h < 24; h++) expected[h] = dayPart(h);
    for (const h of [5, 8, 11]) expect(expected[h]).toBe("morning");
    for (const h of [12, 15, 17]) expect(expected[h]).toBe("afternoon");
    for (const h of [18, 20, 22]) expect(expected[h]).toBe("evening");
    for (const h of [23, 0, 3, 4]) expect(expected[h]).toBe("night");
  });
});

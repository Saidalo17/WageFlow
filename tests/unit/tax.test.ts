import { describe, expect, it } from "vitest";
import { minorDigits } from "@/lib/money";
import { computeTaxes, isTaxCountry, TAX_COUNTRIES, taxCurrency, taxYear, type TaxCountry } from "@/lib/tax";

const amount = (lines: { key: string; amount: number }[] | null, key: string) =>
  lines?.find((l) => l.key === key)?.amount;

describe("computeTaxes", () => {
  it("knows which countries exist and their currencies", () => {
    expect(isTaxCountry("RU")).toBe(true);
    expect(isTaxCountry("XX")).toBe(false);
    expect(isTaxCountry("UZ")).toBe(true);
    expect(taxCurrency("US")).toBe("USD");
    expect(taxYear("DE")).toBe(2025);
  });

  it("returns null when the amounts are not in the country's currency", () => {
    expect(computeTaxes("RU", 10_000_00, "USD")).toBeNull();
  });

  it("returns nothing to pay for no pay", () => {
    expect(computeTaxes("RU", 0, "RUB")).toEqual([]);
  });

  describe("Russia", () => {
    it("13% below the first threshold", () => {
      expect(amount(computeTaxes("RU", 100_000_00, "RUB"), "ndfl")).toBe(13_000_00);
    });
    it("15% on the part above 2.4 million a year", () => {
      // 300 000 x 12 = 3.6M: 13% of 2.4M + 15% of 1.2M = 492 000 a year = 41 000 a month
      expect(amount(computeTaxes("RU", 300_000_00, "RUB"), "ndfl")).toBe(41_000_00);
    });
  });

  describe("United States", () => {
    it("federal tax after the standard deduction, plus Social Security and Medicare", () => {
      const lines = computeTaxes("US", 5_000_00, "USD");
      // 60 000 - 15 750 = 44 250 -> 1 192.50 + 12% of 32 325 (3 879) = 5 071.50 a year = 422.63 a month
      expect(amount(lines, "federalIncome")).toBe(42_263);
      expect(amount(lines, "socialSecurity")).toBe(310_00); // 6.2% of 60 000 / 12
      expect(amount(lines, "medicare")).toBe(72_50);
    });
    it("Social Security stops at the wage base", () => {
      // 40 000 a month = 480 000 a year; the base is 176 100
      expect(amount(computeTaxes("US", 40_000_00, "USD"), "socialSecurity")).toBe(Math.round((176_100 * 0.062 * 100) / 12));
    });
    it("no income tax on a very small pay", () => {
      expect(amount(computeTaxes("US", 1_000_00, "USD"), "federalIncome")).toBeUndefined();
    });
  });

  describe("Germany", () => {
    it("employee contributions at their rates", () => {
      const lines = computeTaxes("DE", 4_000_00, "EUR");
      expect(amount(lines, "pension")).toBe(372_00); // 9.3% of 4 000
      expect(amount(lines, "unemployment")).toBe(52_00); // 1.3%
      expect(amount(lines, "health")).toBe(342_00); // 8.55%
      expect(amount(lines, "care")).toBe(72_00); // 1.8%
    });
    it("income tax is in a sensible range for 48 000 a year (tax class I)", () => {
      const tax = amount(computeTaxes("DE", 4_000_00, "EUR"), "incomeTax")!;
      expect(tax).toBeGreaterThan(520_00); // about 6 279 a year = 523 a month
      expect(tax).toBeLessThan(530_00);
    });
    it("no income tax below the basic allowance", () => {
      expect(amount(computeTaxes("DE", 800_00, "EUR"), "incomeTax")).toBeUndefined();
    });
    it("contributions are capped at the ceilings", () => {
      // 20 000 a month = 240 000 a year; pension ceiling 96 600 a year
      expect(amount(computeTaxes("DE", 20_000_00, "EUR"), "pension")).toBe(Math.round((96_600 * 0.093 * 100) / 12));
    });
  });

  describe("Uzbekistan", () => {
    it("flat 12% income tax and 0.1% pension contribution", () => {
      const scale = 10 ** minorDigits("UZS");
      const lines = computeTaxes("UZ", 10_000_000 * scale, "UZS");
      expect(amount(lines, "incomeTax")).toBe(1_200_000 * scale);
      expect(amount(lines, "pension")).toBe(10_000 * scale);
    });
  });

  describe("every country", () => {
    // A typical monthly gross pay in the country's own currency (major units).
    const typical: Record<TaxCountry, number> = {
      RU: 100_000, US: 5_000, DE: 4_000, ES: 3_000, FR: 3_500, JP: 400_000, KR: 4_000_000, TR: 60_000, CN: 15_000, UZ: 10_000_000,
    };
    const total = (country: TaxCountry, major: number) => {
      const currency = taxCurrency(country);
      const lines = computeTaxes(country, Math.round(major * 10 ** minorDigits(currency)), currency)!;
      return { lines, sum: lines.reduce((s, l) => s + l.amount, 0), gross: major * 10 ** minorDigits(currency) };
    };

    it.each(TAX_COUNTRIES)("%s: sensible taxes for a typical salary", (country) => {
      const { lines, sum, gross } = total(country, typical[country]);
      expect(lines.length).toBeGreaterThan(0);
      expect(lines.every((l) => l.amount > 0 && l.key.length > 0)).toBe(true);
      expect(sum / gross).toBeGreaterThan(0.05);
      expect(sum / gross).toBeLessThan(0.45);
    });

    it.each(TAX_COUNTRIES)("%s: more pay never means less tax", (country) => {
      const a = total(country, typical[country]).sum;
      const b = total(country, typical[country] * 1.5).sum;
      expect(b).toBeGreaterThanOrEqual(a);
    });

    it.each(TAX_COUNTRIES)("%s: taxes never exceed the pay", (country) => {
      const { sum, gross } = total(country, typical[country] * 50);
      expect(sum).toBeLessThan(gross);
    });
  });
});

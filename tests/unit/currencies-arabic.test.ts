import { describe, expect, it, vi } from "vitest";
import { getCurrencies, getCurrencyCodes, isValidCurrency } from "@/lib/currencies";
import { dirOf, intlLocale } from "@/lib/intl-locale";
import { formatMoney } from "@/lib/money";
import { locales, matchLocale } from "@/i18n/config";

describe("the currency list is the same on every device", () => {
  it("does not depend on what the browser reports", async () => {
    // a phone whose browser has no Intl.supportedValuesOf, or only a short list
    const real = (Intl as unknown as { supportedValuesOf?: unknown }).supportedValuesOf;
    vi.resetModules();
    const full = (await import("@/lib/currencies")).getCurrencyCodes();
    for (const fake of [undefined, () => ["USD", "EUR"], () => { throw new Error("nope"); }]) {
      (Intl as unknown as { supportedValuesOf?: unknown }).supportedValuesOf = fake;
      vi.resetModules();
      const codes = (await import("@/lib/currencies")).getCurrencyCodes();
      expect(codes).toEqual(full);
    }
    (Intl as unknown as { supportedValuesOf?: unknown }).supportedValuesOf = real;
  });

  it("holds every ISO 4217 currency in use, including the recent ones", () => {
    const codes = getCurrencyCodes();
    expect(codes.length).toBeGreaterThanOrEqual(160);
    for (const c of ["USD", "EUR", "SAR", "AED", "EGP", "KWD", "QAR", "BHD", "OMR", "JOD", "MAD", "UZS", "XCG", "ZWG", "SLE", "VES", "RUB", "CNY", "JPY"]) {
      expect(codes, c).toContain(c);
      expect(isValidCurrency(c)).toBe(true);
    }
    expect(isValidCurrency("BTC")).toBe(false);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("gives every currency a name and a symbol in every language", () => {
    for (const l of locales) {
      const list = getCurrencies(l);
      expect(list.length, l).toBe(getCurrencyCodes().length);
      for (const c of list) {
        expect(c.name, `${l}:${c.code}`).toBeTruthy();
        expect(c.symbol, `${l}:${c.code}`).toBeTruthy();
      }
    }
  });
});

describe("Arabic", () => {
  it("is a supported language, written right to left", () => {
    expect(locales).toContain("ar");
    expect(dirOf("ar")).toBe("rtl");
    for (const l of locales.filter((x) => x !== "ar")) expect(dirOf(l)).toBe("ltr");
  });

  it("is picked from the browser language", () => {
    expect(matchLocale("ar-SA,ar;q=0.9,en;q=0.5")).toBe("ar");
    expect(matchLocale("ar-EG")).toBe("ar");
  });

  it("shows amounts with Western digits", () => {
    expect(intlLocale("ar")).toBe("ar-u-nu-latn");
    expect(intlLocale("en")).toBe("en");
    const text = formatMoney(125050, "SAR", "ar");
    expect(text).toMatch(/1,250\.50|1٬250٫50|1,250/);
    expect(text).not.toMatch(/[٠-٩]/); // no Arabic-Indic digits
  });
});

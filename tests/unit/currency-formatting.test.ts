import { describe, expect, it } from "vitest";
import { getCurrencies, getCurrencyCodes, isValidCurrency, POPULAR_CURRENCIES } from "@/lib/currencies";
import { formatMoney, minorDigits } from "@/lib/money";

const LOCALES = ["en", "de", "fr", "es", "ru", "zh", "ja", "ko", "tr"] as const;
const CURRENCIES = ["USD", "EUR", "JPY", "KWD", "CNY", "RUB"] as const;

// Spaces are written differently by each language (no-break, narrow no-break). Compare with a plain space.
const plain = (s: string) => s.replace(/[  ]/g, " ");

describe("amounts are written the way each language writes them", () => {
  // 125050 minor units = 1250.50 for most currencies
  it.each([
    ["en", "USD", "$1,250.50"],
    ["de", "EUR", "1.250,50 €"],
    ["fr", "EUR", "1 250,50 €"],
    ["es", "EUR", "1250,50 €"], // Spanish does not group four-digit numbers
    ["ru", "RUB", "1 250,50 ₽"],
    ["zh", "CNY", "¥1,250.50"],
    ["en", "JPY", "¥125,050"], // yen has no minor unit
    ["en", "KWD", "KWD 125.050"], // dinar has three decimals
    ["de", "JPY", "125.050 ¥"],
  ])("%s %s -> %s", (locale, currency, expected) => {
    expect(plain(formatMoney(125050, currency, locale))).toBe(expected);
  });

  describe.each(LOCALES)("%s", (locale) => {
    it.each(CURRENCIES)("%s has the right number of decimals", (currency) => {
      const text = plain(formatMoney(125050, currency, locale));
      expect(text.length).toBeGreaterThan(0);
      const digits = minorDigits(currency);
      const decimals = (re: RegExp) => re.test(text);
      if (digits === 2) expect(decimals(/[.,]\d{2}(?!\d)/)).toBe(true);
      if (digits === 3) expect(decimals(/[.,]\d{3}(?!\d)/)).toBe(true);
      if (digits === 0) expect(decimals(/[.,]\d{2}(?!\d)/)).toBe(false);
    });

    it("negative-free: formats zero and small amounts", () => {
      for (const currency of CURRENCIES) {
        expect(formatMoney(0, currency, locale)).not.toContain("-");
        expect(formatMoney(1, currency, locale)).toMatch(/\d/);
      }
    });
  });
});

describe("the list of currencies", () => {
  it("contains all world currencies, not a short list", () => {
    expect(getCurrencyCodes().length).toBeGreaterThanOrEqual(150);
    for (const code of [...POPULAR_CURRENCIES, "KWD", "BHD", "CHF", "INR", "BRL", "AUD", "CAD", "MXN", "TRY", "UZS"]) {
      expect(isValidCurrency(code), code).toBe(true);
    }
  });

  it("rejects things that are not currencies", () => {
    for (const code of ["", "usd", "XXXX", "BTC", "DOGE", "ABC"]) expect(isValidCurrency(code), code).toBe(false);
  });

  it("shows names in the interface language", () => {
    const name = (locale: string, code: string) => getCurrencies(locale).find((c) => c.code === code)?.name;
    expect(name("en", "EUR")).toBe("Euro");
    expect(name("ru", "EUR")).toBe("евро");
    expect(name("zh", "EUR")).toBe("欧元");
    expect(name("de", "JPY")).toBe("Japanischer Yen");
    expect(name("fr", "USD")).toBe("dollar des États-Unis");
    expect(name("es", "GBP")).toBe("libra esterlina");
  });

  it("gives every currency a name and a symbol, in every language", () => {
    for (const locale of LOCALES) {
      for (const c of getCurrencies(locale)) {
        expect(c.name.length, `${locale} ${c.code}`).toBeGreaterThan(0);
        expect(c.symbol.length, `${locale} ${c.code}`).toBeGreaterThan(0);
      }
    }
  });
});

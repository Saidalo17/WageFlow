import { describe, expect, it } from "vitest";
import { formatMoney, fromMinor, minorDigits, parseAmount, toMinor } from "@/lib/money";
import { parseMinorAmount } from "@/lib/money-input";

describe("minor units depend on the currency", () => {
  it("knows how many decimals a currency has", () => {
    expect(minorDigits("USD")).toBe(2);
    expect(minorDigits("EUR")).toBe(2);
    expect(minorDigits("RUB")).toBe(2);
    expect(minorDigits("CNY")).toBe(2);
    expect(minorDigits("JPY")).toBe(0);
    expect(minorDigits("KWD")).toBe(3);
  });

  it("converts to minor units without floating point surprises", () => {
    expect(toMinor(1250.5, "USD")).toBe(125050);
    expect(toMinor(19.99, "USD")).toBe(1999); // 19.99 * 100 = 1998.9999999999998
    expect(toMinor(0.07, "EUR")).toBe(7);
    expect(toMinor(1250, "JPY")).toBe(1250);
    expect(toMinor(1.234, "KWD")).toBe(1234);
  });

  it("converts back from minor units", () => {
    expect(fromMinor(125050, "USD")).toBe(1250.5);
    expect(fromMinor(1250, "JPY")).toBe(1250);
    expect(fromMinor(1234, "KWD")).toBe(1.234);
  });

  it("round-trips amounts", () => {
    for (const [amount, currency] of [[0.01, "USD"], [999999999.99, "USD"], [5, "JPY"], [0.001, "KWD"], [12345.67, "RUB"]] as const) {
      expect(fromMinor(toMinor(amount, currency), currency)).toBeCloseTo(amount, 6);
    }
  });
});

describe("parseAmount understands what people type", () => {
  it.each([
    ["1250,50", "ru", 1250.5],
    ["1 250.50", "en", 1250.5],
    ["1.250,50", "de", 1250.5],
    ["1,250.50", "en", 1250.5],
    ["1 250,50", "fr", 1250.5],
    ["0,07", "es", 0.07],
    ["1000", "en", 1000],
    ["  42  ", "en", 42],
  ])("%s (%s) -> %s", (text, locale, expected) => {
    expect(parseAmount(text, locale)).toBe(expected);
  });

  it.each(["", "abc", "12a", "--5", "1.2.3,4,5x"])("rejects %j", (text) => {
    expect(parseAmount(text, "en")).toBeNull();
  });
});

describe("parseMinorAmount (what the forms use)", () => {
  it("returns minor units for valid text", () => {
    expect(parseMinorAmount("12,50", "ru", "USD")).toEqual({ ok: true, minor: 1250 });
    expect(parseMinorAmount("1250", "en", "JPY")).toEqual({ ok: true, minor: 1250 });
    expect(parseMinorAmount("1.234", "en", "KWD")).toEqual({ ok: true, minor: 1234 });
  });

  it("explains what is wrong", () => {
    expect(parseMinorAmount("", "en", "USD")).toEqual({ ok: false, error: "amountRequired" });
    expect(parseMinorAmount("0", "en", "USD")).toEqual({ ok: false, error: "amountInvalid" });
    expect(parseMinorAmount("abc", "en", "USD")).toEqual({ ok: false, error: "amountInvalid" });
    expect(parseMinorAmount("12.345", "en", "USD")).toEqual({ ok: false, error: "amountInvalid" }); // too many decimals
    expect(parseMinorAmount("12.5", "en", "JPY")).toEqual({ ok: false, error: "amountInvalid" }); // yen has no decimals
    expect(parseMinorAmount("1000000000", "en", "USD")).toEqual({ ok: false, error: "amountTooLarge" });
    expect(parseMinorAmount("999999999", "en", "USD")).toEqual({ ok: true, minor: 99999999900 });
  });
});

describe("formatMoney", () => {
  it("never prints a negative zero or loses cents", () => {
    expect(formatMoney(0, "USD", "en")).toBe("$0.00");
    expect(formatMoney(5, "USD", "en")).toBe("$0.05");
  });
});

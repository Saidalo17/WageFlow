import { describe, expect, it } from "vitest";
import { parseAmount } from "@/lib/money";
import { caretAfter, formatAmountInput, parseMinorAmount, significantBefore } from "@/lib/money-input";

describe("amount field groups digits while typing", () => {
  it.each([
    ["8000", "8 000"],
    ["8000000", "8 000 000"],
    ["800", "800"],
    ["1234567890", "1 234 567 890"],
    ["8 000 000", "8 000 000"], // already formatted: unchanged
    ["", ""],
    ["abc", ""],
    ["12a3", "123"],
    ["0", "0"],
    ["007", "7"],
  ])("USD %s -> %s", (typed, shown) => {
    expect(formatAmountInput(typed, "USD")).toBe(shown);
  });

  it("keeps the decimal mark the user typed and limits decimals to the currency", () => {
    expect(formatAmountInput("1234,5", "USD")).toBe("1 234,5");
    expect(formatAmountInput("1234.567", "USD")).toBe("1 234.56"); // cents only
    expect(formatAmountInput("1234,", "EUR")).toBe("1 234,");
    expect(formatAmountInput(",5", "EUR")).toBe("0,5"); // a lone mark gets a leading zero
    expect(formatAmountInput("1234.5678", "KWD")).toBe("1 234.567"); // dinar has three
  });

  it("has no decimals at all for currencies without minor units", () => {
    expect(formatAmountInput("1500000", "JPY")).toBe("1 500 000");
    expect(formatAmountInput("1500.5", "JPY")).toBe("1 500");
    expect(formatAmountInput("1500,", "JPY")).toBe("1 500");
  });

  it("works for the soum from the screenshot: 8000 -> 8 000 and 8000000 -> 8 000 000", () => {
    expect(formatAmountInput("8000", "UZS")).toBe("8 000");
    expect(formatAmountInput("8000000", "UZS")).toBe("8 000 000");
  });

  it("is still understood when the amount is saved, in every language", () => {
    for (const locale of ["en", "de", "fr", "es", "ru", "zh", "ja", "ko", "tr"]) {
      expect(parseAmount("8 000 000", locale), locale).toBe(8_000_000);
      expect(parseAmount(formatAmountInput("1234,5", "USD"), locale), locale).toBeCloseTo(1234.5);
      expect(parseAmount(formatAmountInput("1234.5", "USD"), locale), locale).toBeCloseTo(1234.5);
      expect(parseMinorAmount(formatAmountInput("8000000", "UZS"), locale, "UZS")).toEqual({ ok: true, minor: 800_000_000 });
    }
  });

  it("keeps the caret after the same digit when text is regrouped", () => {
    // typing "1" at the end of "8 000" -> raw "8 0001" (caret 6) -> "80 001"; caret must stay at the end
    const raw = "8 0001";
    const formatted = formatAmountInput(raw, "USD");
    expect(formatted).toBe("80 001");
    expect(caretAfter(formatted, significantBefore(raw, 6))).toBe(formatted.length);
    // typing "9" after the first digit of "8 000": raw "89 000", caret 2 -> after the 9
    const raw2 = "89 000";
    const f2 = formatAmountInput(raw2, "USD");
    expect(f2).toBe("89 000");
    expect(caretAfter(f2, significantBefore(raw2, 2))).toBe(2);
    expect(caretAfter("", 0)).toBe(0);
  });
});

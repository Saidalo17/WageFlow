import { describe, expect, it } from "vitest";
import { decodeBytes, detectDelimiter, parseCsv } from "@/lib/import/csv";
import {
  guessDateOrder,
  guessMapping,
  hasHeaderRow,
  NO_COLUMN,
  parseAmountCell,
  parseDate,
  parseRows,
} from "@/lib/import/columns";

describe("decodeBytes", () => {
  it("reads UTF-8, with or without a BOM", () => {
    expect(decodeBytes(new TextEncoder().encode("Зарплата"))).toBe("Зарплата");
    expect(decodeBytes(new Uint8Array([0xef, 0xbb, 0xbf, 0x41]))).toBe("A");
  });
  it("falls back to Windows-1251 for bytes that are not UTF-8", () => {
    // "Магнит" in windows-1251
    expect(decodeBytes(new Uint8Array([0xcc, 0xe0, 0xe3, 0xed, 0xe8, 0xf2]))).toBe("Магнит");
  });
});

describe("parseCsv", () => {
  it("detects the separator", () => {
    expect(detectDelimiter("a;b;c\n1;2;3")).toBe(";");
    expect(detectDelimiter("a,b,c\n1,2,3")).toBe(",");
    expect(detectDelimiter("a\tb\tc\n1\t2\t3")).toBe("\t");
  });
  it("handles quotes, doubled quotes, separators and line breaks inside quotes", () => {
    const rows = parseCsv('date,desc,amount\r\n2026-11-01,"Shop, ""Big"" store",-5.00\n2026-11-02,"two\nlines",10\n');
    expect(rows).toEqual([
      ["date", "desc", "amount"],
      ["2026-11-01", 'Shop, "Big" store', "-5.00"],
      ["2026-11-02", "two\nlines", "10"],
    ]);
  });
  it("skips empty lines", () => {
    expect(parseCsv("a,b\n\n\n1,2\n")).toEqual([["a", "b"], ["1", "2"]]);
  });
});

describe("parseDate", () => {
  it("reads the common formats", () => {
    expect(parseDate("2026-11-05", "dmy")).toBe("2026-11-05");
    expect(parseDate("05.11.2026", "dmy")).toBe("2026-11-05");
    expect(parseDate("05/11/2026 14:30", "dmy")).toBe("2026-11-05");
    expect(parseDate("11/05/2026", "mdy")).toBe("2026-11-05");
    expect(parseDate("5.11.26", "dmy")).toBe("2026-11-05");
    expect(parseDate("2026-11-05T10:00:00", "dmy")).toBe("2026-11-05");
  });
  it("rejects impossible or unreadable dates", () => {
    expect(parseDate("31.02.2026", "dmy")).toBeNull();
    expect(parseDate("13/13/2026", "mdy")).toBeNull();
    expect(parseDate("hello", "dmy")).toBeNull();
    expect(parseDate("", "dmy")).toBeNull();
  });
  it("guesses day-month or month-day from dates that only read one way", () => {
    expect(guessDateOrder(["25/12/2026", "01/02/2026"], "mdy")).toBe("dmy");
    expect(guessDateOrder(["12/25/2026", "01/02/2026"], "dmy")).toBe("mdy");
    expect(guessDateOrder(["01/02/2026"], "mdy")).toBe("mdy");
    expect(guessDateOrder(["2026-01-02"], "mdy")).toBe("ymd");
  });
});

describe("parseAmountCell", () => {
  it("reads signs, brackets and trailing minus", () => {
    expect(parseAmountCell("-3.99", "en")).toBe(-3.99);
    expect(parseAmountCell("(45.00)", "en")).toBe(-45);
    expect(parseAmountCell("12,30-", "ru")).toBe(-12.3);
    expect(parseAmountCell("−500 ₽", "ru")).toBe(-500);
    expect(parseAmountCell("+100", "en")).toBe(100);
  });
  it("reads thousands separators and currency symbols", () => {
    expect(parseAmountCell("$ 1,234.56", "en")).toBe(1234.56);
    expect(parseAmountCell("1 250,50", "ru")).toBe(1250.5);
    expect(parseAmountCell("1.250,50 EUR", "de")).toBe(1250.5);
  });
  it("says null for things that are not amounts", () => {
    expect(parseAmountCell("", "en")).toBeNull();
    expect(parseAmountCell("Total", "en")).toBeNull();
    expect(parseAmountCell("n/a", "en")).toBeNull();
  });
});

describe("column guessing and rows", () => {
  const statement = [
    ["Date", "Description", "Amount", "Balance"],
    ["05.11.2026", "PYATEROCHKA 1234", "-1 250,50", "10 000,00"],
    ["06.11.2026", "Salary November", "250 000,00", "260 000,00"],
    ["07.11.2026", "", "", "260 000,00"],
  ];

  it("finds the header and the columns from the names", () => {
    expect(hasHeaderRow(statement)).toBe(true);
    const m = guessMapping(statement, true, "ru");
    expect(m).toMatchObject({ date: 0, description: 1, amount: 2 });
  });

  it("parses signed rows and counts the rest as skipped", () => {
    const m = guessMapping(statement, true, "ru");
    const r = parseRows(statement, m, true, "dmy", "ru");
    expect(r.rows).toEqual([
      { line: 2, date: "2026-11-05", description: "PYATEROCHKA 1234", amount: -1250.5 },
      { line: 3, date: "2026-11-06", description: "Salary November", amount: 250000 },
    ]);
    expect(r.skipped).toBe(1);
  });

  it("works from the content when there is no header", () => {
    const rows = [
      ["2026-11-05", "Coffee shop on the corner", "-3.50"],
      ["2026-11-06", "Refund", "3.50"],
    ];
    expect(hasHeaderRow(rows)).toBe(false);
    const m = guessMapping(rows, false, "en");
    expect(m).toMatchObject({ date: 0, description: 1, amount: 2 });
  });

  it("supports separate debit and credit columns", () => {
    const rows = [
      ["Datum", "Verwendungszweck", "Soll", "Haben"],
      ["05.11.2026", "Rewe", "45,20", ""],
      ["06.11.2026", "Gehalt", "", "3000,00"],
    ];
    const m = guessMapping(rows, hasHeaderRow(rows), "de");
    expect(m).toMatchObject({ date: 0, description: 1, debit: 2, credit: 3, amount: NO_COLUMN });
    expect(parseRows(rows, m, true, "dmy", "de").rows.map((r) => r.amount)).toEqual([-45.2, 3000]);
  });
});

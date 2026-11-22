import { describe, expect, it } from "vitest";
import { buildReport, periodMonths, resolveReportPeriod, totalsFromRecords } from "@/lib/salary-report";
import type { SalaryRecordRow } from "@/lib/services/salary";

const NOW = new Date(2026, 10, 22);

const rec = (payDate: string, net: number, currency = "USD"): SalaryRecordRow => ({
  id: payDate + net,
  currency,
  title: null,
  payDate,
  mode: "monthly",
  rate: net,
  quantity: 0,
  overtimeHours: 0,
  basePay: net,
  overtimePay: 100,
  bonusTotal: 200,
  gross: net + 50,
  deductionTotal: 50,
  net,
  bonuses: [],
});

describe("resolveReportPeriod", () => {
  it("defaults to the last 12 calendar months", () => {
    const p = resolveReportPeriod(undefined, NOW);
    expect(p).toMatchObject({ kind: "12m", from: "2025-12-01", to: "2026-11-30" });
    expect(resolveReportPeriod("nonsense", NOW).kind).toBe("12m");
  });
  it("accepts a year", () => {
    expect(resolveReportPeriod("2025", NOW)).toMatchObject({ kind: "year", year: 2025, from: "2025-01-01", to: "2025-12-31" });
  });
  it("refuses a year that is out of range", () => {
    expect(resolveReportPeriod("1999", NOW).kind).toBe("12m");
    expect(resolveReportPeriod("20260", NOW).kind).toBe("12m");
  });
  it("lists 12 months", () => {
    expect(periodMonths(resolveReportPeriod("2025", NOW))).toEqual(
      ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"].map((m) => `2025-${m}`),
    );
    const last12 = periodMonths(resolveReportPeriod("12m", NOW));
    expect(last12[0]).toBe("2025-12");
    expect(last12[11]).toBe("2026-11");
  });
});

describe("report totals", () => {
  it("adds calculations up per month", () => {
    const t = totalsFromRecords([rec("2026-10-05", 1000), rec("2026-10-20", 500), rec("2026-11-05", 700)]);
    expect(t.find((m) => m.month === "2026-10")).toMatchObject({ net: 1500, count: 2, bonus: 400, deductions: 100 });
  });

  it("builds a report for the period, only in the user's currency", () => {
    const r = buildReport(
      [rec("2026-11-05", 700), rec("2026-03-10", 300), rec("2026-03-11", 999, "EUR"), rec("2024-01-01", 5)],
      "USD",
      resolveReportPeriod("2026", NOW),
    );
    expect(r.otherCurrency).toBe(1);
    expect(r.records.map((x) => x.payDate)).toEqual(["2024-01-01", "2026-03-10", "2026-11-05"]);
    // 2024 is outside the months of 2026, so it is not in the totals
    expect(r.months).toHaveLength(12);
    expect(r.total.net).toBe(1000);
    expect(r.total.count).toBe(2);
    expect(r.months.find((m) => m.month === "2026-05")?.net).toBe(0);
  });
});

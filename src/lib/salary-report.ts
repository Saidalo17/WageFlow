/**
 * Data for the printable salary report: which period, and the totals for it.
 * Pure functions over saved calculations; money in minor units.
 */

import { todayISO } from "@/lib/format";
import { buildSeries, monthKey, type MonthTotals } from "@/lib/salary-stats";
import type { SalaryRecordRow } from "@/lib/services/salary";

export type ReportPeriod =
  | { kind: "12m"; key: "12m"; from: string; to: string }
  | { kind: "year"; key: string; year: number; from: string; to: string };

/** "12m" (the last 12 calendar months) or a four-digit year. Anything else becomes "12m". */
export function resolveReportPeriod(raw: string | undefined, now = new Date()): ReportPeriod {
  if (raw && /^\d{4}$/.test(raw)) {
    const year = Number(raw);
    if (year >= 2000 && year <= 2100) return { kind: "year", key: raw, year, from: `${raw}-01-01`, to: `${raw}-12-31` };
  }
  return {
    kind: "12m",
    key: "12m",
    from: todayISO(new Date(now.getFullYear(), now.getMonth() - 11, 1)),
    to: todayISO(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  };
}

/** The calendar months of the period, oldest first (YYYY-MM). */
export function periodMonths(period: ReportPeriod): string[] {
  const [fy, fm] = period.from.split("-").map(Number);
  const months: string[] = [];
  for (let i = 0; i < 12; i++) months.push(monthKey(new Date(fy, fm - 1 + i, 1)));
  return months;
}

/** Adds saved calculations up per calendar month of the pay date. */
export function totalsFromRecords(records: Pick<SalaryRecordRow, "payDate" | "gross" | "net" | "bonusTotal" | "deductionTotal" | "overtimePay">[]): MonthTotals[] {
  const byMonth = new Map<string, MonthTotals>();
  for (const r of records) {
    const month = r.payDate.slice(0, 7);
    const t = byMonth.get(month) ?? { month, gross: 0, net: 0, bonus: 0, deductions: 0, overtime: 0, count: 0 };
    t.gross += r.gross;
    t.net += r.net;
    t.bonus += r.bonusTotal;
    t.deductions += r.deductionTotal;
    t.overtime += r.overtimePay;
    t.count += 1;
    byMonth.set(month, t);
  }
  return [...byMonth.values()];
}

export type SalaryReport = {
  period: ReportPeriod;
  currency: string;
  /** Calculations in the user's currency, oldest first. */
  records: SalaryRecordRow[];
  /** How many calculations in other currencies were left out. */
  otherCurrency: number;
  /** All 12 months of the period, with zeros where nothing was paid. */
  months: MonthTotals[];
  total: Omit<MonthTotals, "month">;
};

export function buildReport(records: SalaryRecordRow[], currency: string, period: ReportPeriod): SalaryReport {
  const own = records.filter((r) => r.currency === currency).sort((a, b) => a.payDate.localeCompare(b.payDate));
  const months = buildSeries(totalsFromRecords(own), periodMonths(period));
  const sum = (key: "gross" | "net" | "bonus" | "deductions" | "overtime" | "count") =>
    months.reduce((s, m) => s + m[key], 0);
  return {
    period,
    currency,
    records: own,
    otherCurrency: records.length - own.length,
    months,
    total: {
      gross: sum("gross"),
      net: sum("net"),
      bonus: sum("bonus"),
      deductions: sum("deductions"),
      overtime: sum("overtime"),
      count: sum("count"),
    },
  };
}

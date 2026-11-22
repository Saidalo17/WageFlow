/**
 * Salary statistics: monthly series, comparison with the previous month, a year summary,
 * growth and a simple trend forecast. Pure functions over per-month totals (calendar months of the pay date).
 * Money is in minor units.
 */

import { percentChange } from "@/lib/period";

export type MonthTotals = {
  /** YYYY-MM */
  month: string;
  gross: number;
  net: number;
  bonus: number;
  deductions: number;
  overtime: number;
  /** Number of saved calculations in the month. */
  count: number;
};

const EMPTY = { gross: 0, net: 0, bonus: 0, deductions: 0, overtime: 0, count: 0 };

export function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/** The `n` calendar months ending with the month of `now` (oldest first), shifted back by `offset` months. */
export function monthKeys(n: number, now: Date, offset = 0): string[] {
  const keys: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    keys.push(monthKey(new Date(now.getFullYear(), now.getMonth() - i - offset, 1)));
  }
  return keys;
}

export function addMonths(key: string, n: number): string {
  const [y, m] = key.split("-").map(Number);
  return monthKey(new Date(y, m - 1 + n, 1));
}

/** Zero-filled totals for the given months. */
export function buildSeries(totals: MonthTotals[], keys: string[]): MonthTotals[] {
  const byMonth = new Map(totals.map((t) => [t.month, t]));
  return keys.map((month) => byMonth.get(month) ?? { month, ...EMPTY });
}

const sum = (rows: MonthTotals[], key: "gross" | "net" | "bonus" | "deductions" | "overtime") =>
  rows.reduce((s, r) => s + r[key], 0);

export type Change = number | null;

/** This month against the previous one. A change is null when the previous month had no pay. */
export function compareWithPreviousMonth(totals: MonthTotals[], now: Date) {
  const [prevKey, curKey] = monthKeys(2, now);
  const [prev, cur] = buildSeries(totals, [prevKey, curKey]);
  return {
    current: cur,
    previous: prev,
    net: percentChange(cur.net, prev.net),
    gross: percentChange(cur.gross, prev.gross),
    bonus: percentChange(cur.bonus, prev.bonus),
  };
}

export type YearStats = {
  gross: number;
  net: number;
  bonus: number;
  deductions: number;
  overtime: number;
  /** Months of the last 12 that have at least one saved calculation. */
  monthsWithPay: number;
  /** Average net pay of those months. */
  averageNet: number;
  best: MonthTotals | null;
  /** Share of the gross pay that went to deductions, 0..1. */
  deductionRate: number;
};

/** Summary of the last 12 months, the current one included. */
export function yearStats(totals: MonthTotals[], now: Date): YearStats {
  const rows = buildSeries(totals, monthKeys(12, now));
  const paid = rows.filter((r) => r.count > 0);
  const gross = sum(rows, "gross");
  const net = sum(rows, "net");
  const deductions = sum(rows, "deductions");
  return {
    gross,
    net,
    bonus: sum(rows, "bonus"),
    deductions,
    overtime: sum(rows, "overtime"),
    monthsWithPay: paid.length,
    averageNet: paid.length ? Math.round(net / paid.length) : 0,
    best: paid.length ? paid.reduce((a, b) => (b.net > a.net ? b : a)) : null,
    deductionRate: gross > 0 ? deductions / gross : 0,
  };
}

export type Growth = {
  /** Average monthly net of the last 3 months against the 3 months before. Null without data in both. */
  recent: Change;
  /** Net of the last 12 months against the 12 months before. Null without data in the earlier year. */
  yearly: Change;
};

function averageNet(rows: MonthTotals[]): number | null {
  const paid = rows.filter((r) => r.count > 0);
  return paid.length ? sum(paid, "net") / paid.length : null;
}

export function growth(totals: MonthTotals[], now: Date): Growth {
  const recentAvg = averageNet(buildSeries(totals, monthKeys(3, now)));
  const earlierAvg = averageNet(buildSeries(totals, monthKeys(3, now, 3)));
  const thisYear = sum(buildSeries(totals, monthKeys(12, now)), "net");
  const lastYear = sum(buildSeries(totals, monthKeys(12, now, 12)), "net");
  return {
    recent: recentAvg !== null && earlierAvg !== null && earlierAvg > 0 ? percentChange(recentAvg, earlierAvg) : null,
    yearly: percentChange(thisYear, lastYear),
  };
}

export type Forecast = {
  /** Predicted net pay for the next months, never below zero. */
  months: { month: string; net: number }[];
  /** Change of the trend line per month, minor units. */
  slope: number;
  /** How many months of data the trend is based on. */
  basedOn: number;
  /** Average monthly net times 12: what a year looks like if pay stays as it was. */
  yearEstimate: number;
};

/** Minimum number of months with pay needed to draw a trend. */
export const MIN_FORECAST_MONTHS = 3;

/**
 * Straight-line (least squares) trend through the net pay of the last 12 months that had pay,
 * continued for `ahead` months. Returns null when there are fewer than 3 such months.
 * It is an estimate from past pay only; it knows nothing about raises or changes of work.
 */
export function forecast(totals: MonthTotals[], now: Date, ahead = 3): Forecast | null {
  const keys = monthKeys(12, now);
  const rows = buildSeries(totals, keys);
  const points = rows.map((r, x) => ({ x, y: r.net, count: r.count })).filter((p) => p.count > 0);
  if (points.length < MIN_FORECAST_MONTHS) return null;

  const n = points.length;
  const mx = points.reduce((s, p) => s + p.x, 0) / n;
  const my = points.reduce((s, p) => s + p.y, 0) / n;
  const sxx = points.reduce((s, p) => s + (p.x - mx) ** 2, 0);
  const sxy = points.reduce((s, p) => s + (p.x - mx) * (p.y - my), 0);
  const slope = sxx === 0 ? 0 : sxy / sxx;
  const intercept = my - slope * mx;

  const last = keys[keys.length - 1];
  return {
    months: Array.from({ length: ahead }, (_, i) => ({
      month: addMonths(last, i + 1),
      net: Math.max(0, Math.round(intercept + slope * (keys.length + i))),
    })),
    slope: Math.round(slope),
    basedOn: n,
    yearEstimate: Math.round(my * 12),
  };
}

import type { Display } from "@/lib/display-currency";

/** Helpers that convert what the services return (always the main currency) into the display currency. */

type Conv = Pick<Display, "convert">;

export const convertTotals = (d: Conv, t: { income: number; expense: number }) => ({
  income: d.convert(t.income),
  expense: d.convert(t.expense),
});

export const convertSeries = <T extends { income: number; expense: number }>(d: Conv, points: T[]): T[] =>
  points.map((p) => ({ ...p, income: d.convert(p.income), expense: d.convert(p.expense) }));

export const convertTotalsBy = <T extends { total: number }>(d: Conv, rows: T[]): T[] =>
  rows.map((r) => ({ ...r, total: d.convert(r.total) }));

export const convertBudgets = <T extends { limit: number; spent: number }>(d: Conv, rows: T[]): T[] =>
  rows.map((r) => ({ ...r, limit: d.convert(r.limit), spent: d.convert(r.spent) }));

/** Shown amount of a transaction; the original (typed) amount is left alone. */
export const convertTransactions = <T extends { amount: number }>(d: Conv, rows: T[]): T[] =>
  rows.map((r) => ({ ...r, amount: d.convert(r.amount) }));

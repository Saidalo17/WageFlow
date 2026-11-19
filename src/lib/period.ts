import { todayISO } from "@/lib/format";

/**
 * The "month" the user sees. With monthStartDay = 1 it is the calendar month;
 * with 15 it runs from the 15th to the 14th of the next month.
 */
export function currentPeriod(monthStartDay = 1, today = new Date()) {
  const day = Math.min(Math.max(monthStartDay, 1), 28);
  const start =
    today.getDate() >= day
      ? new Date(today.getFullYear(), today.getMonth(), day)
      : new Date(today.getFullYear(), today.getMonth() - 1, day);
  const nextStart = new Date(start.getFullYear(), start.getMonth() + 1, day);
  const end = new Date(nextStart.getFullYear(), nextStart.getMonth(), nextStart.getDate() - 1);
  return { from: todayISO(start), to: todayISO(end) };
}

function parseISO(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return { y, m, d };
}

/** Every date from `from` to `to` inclusive, as YYYY-MM-DD (calendar math in UTC, no time zones involved). */
export function eachDay(from: string, to: string): string[] {
  const a = parseISO(from);
  const b = parseISO(to);
  const out: string[] = [];
  for (
    let t = Date.UTC(a.y, a.m - 1, a.d), end = Date.UTC(b.y, b.m - 1, b.d);
    t <= end;
    t += 86_400_000
  ) {
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out;
}

/** Every month touched by the range, as YYYY-MM. */
export function eachMonth(from: string, to: string): string[] {
  const a = parseISO(from);
  const b = parseISO(to);
  const out: string[] = [];
  for (let y = a.y, m = a.m; y < b.y || (y === b.y && m <= b.m); m === 12 ? (y++, (m = 1)) : m++) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
  }
  return out;
}

/**
 * Cuts a period that has not ended yet at "tomorrow", so a chart of the current month
 * does not trail off into empty future days. Tomorrow (not today) keeps the visitor's own
 * "today" inside the chart even when the server is in an earlier time zone.
 */
export function capAtTomorrow(to: string, now = new Date()): string {
  const tomorrow = todayISO(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));
  return to > tomorrow ? tomorrow : to;
}

export const RANGES = ["month", "prev", "quarter", "year", "all"] as const;
export type Range = (typeof RANGES)[number];

export function isRange(value: unknown): value is Range {
  return typeof value === "string" && (RANGES as readonly string[]).includes(value);
}

/** Date bounds (inclusive, YYYY-MM-DD) for a named range. `all` has no bounds. */
export function rangeBounds(
  range: Range,
  monthStartDay = 1,
  today = new Date(),
): { from?: string; to?: string } {
  if (range === "all") return {};
  const day = Math.min(Math.max(monthStartDay, 1), 28);
  const current = currentPeriod(day, today);
  const [y, m, d] = current.from.split("-").map(Number);

  if (range === "month") return current;
  if (range === "prev") {
    const dayBefore = new Date(y, m - 1, d - 1);
    return currentPeriod(day, dayBefore);
  }
  // quarter = this period and the 2 before it; year = this period and the 11 before it.
  const back = range === "quarter" ? 2 : 11;
  return { from: todayISO(new Date(y, m - 1 - back, d)), to: current.to };
}

/* ---------- Analytics periods ---------- */

export function addDays(iso: string, n: number): string {
  const { y, m, d } = parseISO(iso);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** Number of days from `from` to `to`, counting both ends. */
export function daysBetween(from: string, to: string): number {
  const a = parseISO(from);
  const b = parseISO(to);
  return Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86_400_000) + 1;
}

export function isRealDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const { y, m, d } = parseISO(s);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d && y >= 1970;
}

export const ANALYTICS_RANGES = ["week", "month", "prev", "quarter", "year", "custom"] as const;
export type AnalyticsRange = (typeof ANALYTICS_RANGES)[number];

export function isAnalyticsRange(value: unknown): value is AnalyticsRange {
  return typeof value === "string" && (ANALYTICS_RANGES as readonly string[]).includes(value);
}

export const MAX_CUSTOM_DAYS = 1830; // about 5 years

/** Checks a user-typed date range. Returns null when it is not usable. */
export function parseCustomRange(from?: string, to?: string): { from: string; to: string } | null {
  if (!from || !to || !isRealDate(from) || !isRealDate(to) || from > to) return null;
  if (daysBetween(from, to) > MAX_CUSTOM_DAYS) return null;
  return { from, to };
}

export function analyticsBounds(
  range: AnalyticsRange,
  monthStartDay: number,
  custom: { from: string; to: string } | null,
  now = new Date(),
): { from: string; to: string } {
  if (range === "custom" && custom) return custom;
  if (range === "week") {
    const to = todayISO(now);
    return { from: addDays(to, -6), to };
  }
  const r = range === "custom" ? "month" : range;
  return rangeBounds(r, monthStartDay, now) as { from: string; to: string };
}

/**
 * The period to compare with. It covers the same number of days as the part of the
 * current period that has already happened, so "this month so far" is compared with the
 * same days of last month rather than with a whole month.
 */
export function comparisonBounds(
  range: AnalyticsRange,
  bounds: { from: string; to: string },
  monthStartDay: number,
  now = new Date(),
): { from: string; to: string } {
  const today = todayISO(now);
  const effectiveTo = bounds.to > today ? (bounds.from > today ? bounds.from : today) : bounds.to;
  const days = daysBetween(bounds.from, effectiveTo);

  if (range === "month") {
    const prev = rangeBounds("prev", monthStartDay, now) as { from: string; to: string };
    const to = addDays(prev.from, days - 1);
    return { from: prev.from, to: to > prev.to ? prev.to : to };
  }
  if (range === "prev") {
    const { y, m, d } = parseISO(addDays(bounds.from, -1));
    return currentPeriod(monthStartDay, new Date(y, m - 1, d));
  }
  const to = addDays(bounds.from, -1);
  return { from: addDays(to, -(days - 1)), to };
}

/** Relative change, or null when there is nothing to compare with (previous value is 0). */
export function percentChange(current: number, previous: number): number | null {
  return previous === 0 ? null : (current - previous) / previous;
}

/** The last `n` calendar months including the current one: from the 1st of the oldest to (about) today. */
export function lastMonths(n: number, now = new Date()): { from: string; to: string } {
  const from = todayISO(new Date(now.getFullYear(), now.getMonth() - (n - 1), 1));
  const endOfMonth = todayISO(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  return { from, to: capAtTomorrow(endOfMonth, now) };
}
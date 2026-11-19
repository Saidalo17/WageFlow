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

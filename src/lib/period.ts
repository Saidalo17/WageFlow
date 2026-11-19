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

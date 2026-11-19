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

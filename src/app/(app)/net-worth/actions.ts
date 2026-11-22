"use server";

import { addDaysISO, daysUntil } from "@/lib/salary-schedule";
import { todayISO } from "@/lib/format";
import { loadNetWorth, upsertSnapshot } from "@/lib/services/net-worth";
import { getCurrentUser } from "@/lib/session";
import { snapshotDateSchema } from "@/lib/validators/finance";

/**
 * Saves today's net worth for the history chart. The figures are worked out here from the database,
 * never taken from the browser; the browser only says which day it is (within a day of the server's).
 */
export async function recordSnapshot(clientDate: unknown): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  const parsed = snapshotDateSchema.safeParse(clientDate);
  if (!parsed.success) return { ok: false };
  const serverToday = todayISO();
  if (Math.abs(daysUntil(parsed.data, serverToday)) > 1) return { ok: false };
  // Never save a date in the future of the server's calendar by more than the allowed day.
  if (parsed.data > addDaysISO(serverToday, 1)) return { ok: false };

  const result = await loadNetWorth(user.id, user.currency);
  if (!result.ok) return { ok: false };
  const { assets, liabilities, netWorth } = result.netWorth;
  // An empty picture is not worth a point on the chart.
  if (assets === 0 && liabilities === 0) return { ok: true };
  await upsertSnapshot(user.id, parsed.data, user.currency, { assets, liabilities, netWorth });
  return { ok: true };
}

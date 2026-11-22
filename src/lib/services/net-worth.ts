import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { netWorthSnapshots } from "@/lib/db/schema";
import { remaining } from "@/lib/debts";
import { getLatestTable, minorMultiplier, rateFromTable } from "@/lib/fx";
import { computeNetWorth, type NetWorth, type WorthItem } from "@/lib/net-worth";
import { listAccounts } from "@/lib/services/accounts";
import { listDebts } from "@/lib/services/debts";

/**
 * Every function takes the signed-in user's id and puts it in the WHERE clause,
 * so one user can never read or write another user's net worth history.
 */

export type NetWorthResult =
  | { ok: true; netWorth: NetWorth }
  /** There are items in other currencies and today's exchange rates could not be loaded. */
  | { ok: false; reason: "ratesUnavailable" };

/**
 * The user's net worth today, in `currency`: active accounts that count (a negative balance is a liability),
 * debts still open (what you owe is a liability, what is owed to you an asset). Other currencies are converted
 * at today's rates.
 */
export async function loadNetWorth(userId: string, currency: string): Promise<NetWorthResult> {
  const [accounts, debts] = await Promise.all([listAccounts(userId), listDebts(userId)]);

  const items: WorthItem[] = [
    ...accounts
      .filter((a) => a.inNetWorth && !a.isArchived)
      .map((a) => ({ kind: "account" as const, id: a.id, name: a.name, currency: a.currency, amount: a.balance })),
    ...debts.flatMap((d) => {
      const left = remaining(d.principal, d.paid);
      if (left <= 0) return [];
      return [{ kind: "debt" as const, id: d.id, name: d.name, currency: d.currency, amount: d.direction === "owed_by_me" ? -left : left }];
    }),
  ].filter((i) => i.amount !== 0);

  const foreign = items.some((i) => i.currency !== currency);
  if (!foreign) return { ok: true, netWorth: computeNetWorth(items, currency, (m) => m) };

  try {
    const table = await getLatestTable();
    const factors = new Map<string, number>();
    const convert = (minor: number, from: string) => {
      let f = factors.get(from);
      if (f === undefined) {
        f = minorMultiplier(from, currency, rateFromTable(table, from, currency));
        factors.set(from, f);
      }
      return Math.round(minor * f);
    };
    return { ok: true, netWorth: computeNetWorth(items, currency, convert) };
  } catch {
    return { ok: false, reason: "ratesUnavailable" };
  }
}

export type SnapshotRow = { date: string; assets: number; liabilities: number; netWorth: number };

/** One snapshot per day: saving again on the same day replaces it. */
export async function upsertSnapshot(userId: string, date: string, currency: string, nw: Pick<NetWorth, "assets" | "liabilities" | "netWorth">) {
  await db
    .insert(netWorthSnapshots)
    .values({ userId, date, currency, assets: nw.assets, liabilities: nw.liabilities, netWorth: nw.netWorth })
    .onConflictDoUpdate({
      target: [netWorthSnapshots.userId, netWorthSnapshots.date],
      set: { currency, assets: nw.assets, liabilities: nw.liabilities, netWorth: nw.netWorth },
    });
}

/** The newest snapshots in the given currency, oldest first. */
export async function listSnapshots(userId: string, currency: string, limit = 365): Promise<SnapshotRow[]> {
  const rows = await db
    .select({
      date: netWorthSnapshots.date,
      assets: netWorthSnapshots.assets,
      liabilities: netWorthSnapshots.liabilities,
      netWorth: netWorthSnapshots.netWorth,
    })
    .from(netWorthSnapshots)
    .where(and(eq(netWorthSnapshots.userId, userId), eq(netWorthSnapshots.currency, currency)))
    .orderBy(desc(netWorthSnapshots.date))
    .limit(limit);
  return rows.reverse();
}


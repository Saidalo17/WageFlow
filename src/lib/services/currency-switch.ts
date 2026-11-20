import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { budgets, transactions, users } from "@/lib/db/schema";
import { getLatestTable, minorMultiplier, rateFromTable } from "@/lib/fx";

type ProfileChanges = { name: string | null; locale: string; monthStartDay: number };

/**
 * Changes the user's main currency and recalculates every amount at today's rate, all or nothing.
 *
 * Transactions are recalculated from what was originally typed (original amount + currency), not from
 * the previous converted value, so switching USD → EUR → USD gives back exactly the same numbers.
 * Limits (budgets) have no original, so they are converted from their current value.
 *
 * Throws RatesUnavailableError (and changes nothing) when the rates cannot be loaded.
 */
export async function switchUserCurrency(
  userId: string,
  from: string,
  to: string,
  profile: ProfileChanges,
) {
  const table = await getLatestTable();

  const originals = await db
    .selectDistinct({ currency: transactions.originalCurrency })
    .from(transactions)
    .where(eq(transactions.userId, userId));

  // Work out every multiplier before touching the database, so a missing rate changes nothing.
  const txUpdates = originals
    .map((r) => r.currency)
    .filter((c): c is string => !!c)
    .map((currency) => ({
      currency,
      multiplier: minorMultiplier(currency, to, rateFromTable(table, currency, to)),
    }));
  const budgetMultiplier = minorMultiplier(from, to, rateFromTable(table, from, to));

  await db.batch([
    db
      .update(users)
      .set({ name: profile.name, currency: to, locale: profile.locale, monthStartDay: profile.monthStartDay })
      .where(eq(users.id, userId)),
    ...txUpdates.map(({ currency, multiplier }) =>
      db
        .update(transactions)
        .set({
          amount:
            currency === to
              ? sql`${transactions.originalAmount}`
              : sql`max(1, cast(round(${transactions.originalAmount} * ${multiplier}) as integer))`,
        })
        .where(and(eq(transactions.userId, userId), eq(transactions.originalCurrency, currency))),
    ),
    db
      .update(budgets)
      .set({ limitAmount: sql`max(1, cast(round(${budgets.limitAmount} * ${budgetMultiplier}) as integer))` })
      .where(eq(budgets.userId, userId)),
  ]);
}

import { and, desc, gte, isNotNull, lte, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { transactions } from "@/lib/db/schema";
import type { HistoryEntry } from "@/lib/import/categorize";

/**
 * Every function takes the signed-in user's id and puts it in the WHERE clause,
 * so one user can never read or add to another user's transactions.
 */

/** Descriptions of the user's earlier operations with their categories: what the import learns from. */
export async function loadLearningHistory(userId: string, limit = 5000): Promise<HistoryEntry[]> {
  const rows = await db
    .select({ note: transactions.note, categoryId: transactions.categoryId, type: transactions.type })
    .from(transactions)
    .where(and(eq(transactions.userId, userId), isNotNull(transactions.note)))
    .orderBy(desc(transactions.occurredOn))
    .limit(limit);
  return rows;
}

/** Existing operations in a date range (to spot rows that were imported or added before). */
export async function existingBetween(userId: string, from: string, to: string) {
  return db
    .select({ occurredOn: transactions.occurredOn, type: transactions.type, amount: transactions.amount })
    .from(transactions)
    .where(and(eq(transactions.userId, userId), gte(transactions.occurredOn, from), lte(transactions.occurredOn, to)));
}

export type ImportRow = {
  date: string;
  note: string | null;
  amount: number;
  type: "income" | "expense";
  categoryId: string;
  accountId?: string | null;
};

/** Adds the rows, all or nothing. Amounts are in the user's main currency (what was in the file is taken as that). */
export async function insertImported(userId: string, currency: string, rows: ImportRow[]): Promise<number> {
  const CHUNK = 100;
  const statements = [];
  for (let i = 0; i < rows.length; i += CHUNK) {
    statements.push(
      db.insert(transactions).values(
        rows.slice(i, i + CHUNK).map((r) => ({
          userId,
          categoryId: r.categoryId,
          accountId: r.accountId ?? null,
          type: r.type,
          amount: r.amount,
          originalAmount: r.amount,
          originalCurrency: currency,
          occurredOn: r.date,
          note: r.note,
        })),
      ),
    );
  }
  if (statements.length === 0) return 0;
  await db.batch(statements as [(typeof statements)[number], ...(typeof statements)[number][]]);
  return rows.length;
}

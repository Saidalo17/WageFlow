import { and, desc, eq, gte, inArray, lte, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { categories, transactions } from "@/lib/db/schema";
import type { TransactionValues } from "@/lib/validators/transaction";

/**
 * Every function takes the signed-in user's id and puts it in the WHERE clause,
 * so one user can never read or change another user's transactions.
 */

export type TxFilters = {
  type?: "income" | "expense";
  categoryId?: string;
  from?: string;
  to?: string;
  /** Text to look for in the note and in the category name. */
  q?: string;
  /** Standard categories whose *translated* name matches the search text. */
  systemKeys?: string[];
};

function escapeLike(s: string) {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/** SQLite's LIKE ignores case only for ASCII, so also try common casings of the text. */
function casings(q: string) {
  const lower = q.toLowerCase();
  return [...new Set([q, lower, q.toUpperCase(), lower.charAt(0).toUpperCase() + lower.slice(1)])];
}

function whereOf(userId: string, f: TxFilters): SQL {
  const conds: (SQL | undefined)[] = [eq(transactions.userId, userId)];
  if (f.type) conds.push(eq(transactions.type, f.type));
  if (f.categoryId) conds.push(eq(transactions.categoryId, f.categoryId));
  if (f.from) conds.push(gte(transactions.occurredOn, f.from));
  if (f.to) conds.push(lte(transactions.occurredOn, f.to));
  const q = f.q?.trim();
  if (q) {
    const patterns = casings(q).map((v) => `%${escapeLike(v)}%`);
    const textMatches = patterns.flatMap((p) => [
      sql`${transactions.note} LIKE ${p} ESCAPE '\\'`,
      sql`${categories.name} LIKE ${p} ESCAPE '\\'`,
    ]);
    if (f.systemKeys?.length) textMatches.push(inArray(categories.systemKey, f.systemKeys));
    conds.push(or(...textMatches));
  }
  return and(...conds)!;
}

export async function listTransactions(userId: string, filters: TxFilters, limit: number) {
  const rows = await db
    .select({
      id: transactions.id,
      type: transactions.type,
      amount: transactions.amount,
      occurredOn: transactions.occurredOn,
      note: transactions.note,
      categoryId: transactions.categoryId,
      categoryName: categories.name,
      categorySystemKey: categories.systemKey,
      categoryColor: categories.color,
      categoryIcon: categories.icon,
    })
    .from(transactions)
    .innerJoin(categories, eq(categories.id, transactions.categoryId))
    .where(whereOf(userId, filters))
    .orderBy(desc(transactions.occurredOn), desc(transactions.createdAt), desc(transactions.id))
    .limit(limit + 1);
  return { items: rows.slice(0, limit), hasMore: rows.length > limit };
}

/** Totals of everything matching the filters (not only the visible page). */
export async function sumTransactions(userId: string, filters: TxFilters) {
  const rows = await db
    .select({
      type: transactions.type,
      total: sql<number>`coalesce(sum(${transactions.amount}), 0)`.mapWith(Number),
    })
    .from(transactions)
    .innerJoin(categories, eq(categories.id, transactions.categoryId))
    .where(whereOf(userId, filters))
    .groupBy(transactions.type);
  return {
    income: rows.find((r) => r.type === "income")?.total ?? 0,
    expense: rows.find((r) => r.type === "expense")?.total ?? 0,
  };
}

export async function getTransaction(userId: string, id: string) {
  const [row] = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.id, id), eq(transactions.userId, userId)));
  return row ?? null;
}

export async function insertTransaction(userId: string, values: TransactionValues, id?: string) {
  const [row] = await db
    .insert(transactions)
    .values({ ...values, userId, ...(id ? { id } : {}) })
    .returning({ id: transactions.id });
  return row;
}

export async function updateTransactionRow(userId: string, id: string, values: TransactionValues) {
  const res = await db
    .update(transactions)
    .set({ ...values, updatedAt: Date.now() })
    .where(and(eq(transactions.id, id), eq(transactions.userId, userId)));
  return res.rowsAffected > 0;
}

export async function deleteTransactionRow(userId: string, id: string) {
  const res = await db
    .delete(transactions)
    .where(and(eq(transactions.id, id), eq(transactions.userId, userId)));
  return res.rowsAffected > 0;
}

import { and, asc, count, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { categories, transactions } from "@/lib/db/schema";
import type { CategoryValues } from "@/lib/validators/category";

/**
 * Every function takes the signed-in user's id and puts it in the WHERE clause,
 * so one user can never read or change another user's categories.
 */

export async function listCategoriesWithTotals(
  userId: string,
  period: { from: string; to: string },
) {
  return db
    .select({
      id: categories.id,
      name: categories.name,
      type: categories.type,
      color: categories.color,
      icon: categories.icon,
      isArchived: categories.isArchived,
      systemKey: categories.systemKey,
      total: sql<number>`coalesce(sum(${transactions.amount}), 0)`.mapWith(Number),
    })
    .from(categories)
    .leftJoin(
      transactions,
      and(
        eq(transactions.categoryId, categories.id),
        eq(transactions.userId, userId),
        gte(transactions.occurredOn, period.from),
        lte(transactions.occurredOn, period.to),
      ),
    )
    .where(eq(categories.userId, userId))
    .groupBy(categories.id)
    .orderBy(asc(categories.isArchived), sql`categories.rowid`);
}

export async function listCategories(userId: string) {
  return db
    .select({
      id: categories.id,
      name: categories.name,
      type: categories.type,
      color: categories.color,
      icon: categories.icon,
      isArchived: categories.isArchived,
      systemKey: categories.systemKey,
    })
    .from(categories)
    .where(eq(categories.userId, userId))
    .orderBy(asc(categories.isArchived), sql`categories.rowid`);
}

export async function getCategory(userId: string, id: string) {
  const [row] = await db
    .select()
    .from(categories)
    .where(and(eq(categories.id, id), eq(categories.userId, userId)));
  return row ?? null;
}

export async function countCategoryTransactions(userId: string, id: string) {
  const [row] = await db
    .select({ n: count() })
    .from(transactions)
    .where(and(eq(transactions.categoryId, id), eq(transactions.userId, userId)));
  return row?.n ?? 0;
}

export async function insertCategory(userId: string, values: CategoryValues) {
  const [row] = await db
    .insert(categories)
    .values({ ...values, userId })
    .returning({ id: categories.id });
  return row;
}

export async function updateCategoryRow(
  userId: string,
  id: string,
  values: { name?: string; color: string; icon: string; systemKey?: string | null },
) {
  const res = await db
    .update(categories)
    .set(values)
    .where(and(eq(categories.id, id), eq(categories.userId, userId)));
  return res.rowsAffected > 0;
}

export async function setCategoryArchived(userId: string, id: string, archived: boolean) {
  const res = await db
    .update(categories)
    .set({ isArchived: archived })
    .where(and(eq(categories.id, id), eq(categories.userId, userId)));
  return res.rowsAffected > 0;
}

export async function deleteCategoryRow(userId: string, id: string) {
  const res = await db
    .delete(categories)
    .where(and(eq(categories.id, id), eq(categories.userId, userId)));
  return res.rowsAffected > 0;
}

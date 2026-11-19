import { and, asc, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { budgets, categories, transactions } from "@/lib/db/schema";

/**
 * Every function takes the signed-in user's id and puts it in the WHERE clause,
 * so one user can never read or change another user's budgets.
 */

export type BudgetRow = {
  id: string;
  categoryId: string;
  name: string;
  systemKey: string | null;
  color: string;
  icon: string;
  isArchived: boolean;
  /** Monthly limit, minor units. */
  limit: number;
  /** Expenses of the category in the period, minor units. */
  spent: number;
};

/** Budgets with how much has been spent from each in the given period. */
export async function listBudgets(
  userId: string,
  period: { from: string; to: string },
): Promise<BudgetRow[]> {
  return db
    .select({
      id: budgets.id,
      categoryId: budgets.categoryId,
      name: categories.name,
      systemKey: categories.systemKey,
      color: categories.color,
      icon: categories.icon,
      isArchived: categories.isArchived,
      limit: budgets.limitAmount,
      spent: sql<number>`coalesce(sum(${transactions.amount}), 0)`.mapWith(Number),
    })
    .from(budgets)
    .innerJoin(categories, eq(categories.id, budgets.categoryId))
    .leftJoin(
      transactions,
      and(
        eq(transactions.categoryId, budgets.categoryId),
        eq(transactions.userId, userId),
        eq(transactions.type, "expense"),
        gte(transactions.occurredOn, period.from),
        lte(transactions.occurredOn, period.to),
      ),
    )
    .where(eq(budgets.userId, userId))
    .groupBy(budgets.id)
    .orderBy(asc(sql`budgets.rowid`));
}

export async function getBudget(userId: string, id: string) {
  const [row] = await db
    .select()
    .from(budgets)
    .where(and(eq(budgets.id, id), eq(budgets.userId, userId)));
  return row ?? null;
}

export async function insertBudget(userId: string, categoryId: string, limitAmount: number) {
  const [row] = await db
    .insert(budgets)
    .values({ userId, categoryId, limitAmount })
    .returning({ id: budgets.id });
  return row;
}

export async function updateBudgetLimit(userId: string, id: string, limitAmount: number) {
  const res = await db
    .update(budgets)
    .set({ limitAmount })
    .where(and(eq(budgets.id, id), eq(budgets.userId, userId)));
  return res.rowsAffected > 0;
}

export async function deleteBudgetRow(userId: string, id: string) {
  const res = await db
    .delete(budgets)
    .where(and(eq(budgets.id, id), eq(budgets.userId, userId)));
  return res.rowsAffected > 0;
}

/** How much of a limit is used: 0.5 = half. Can be above 1 when the limit is exceeded. */
export function usedRatio(spent: number, limit: number) {
  return limit > 0 ? spent / limit : 0;
}

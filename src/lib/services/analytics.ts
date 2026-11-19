import { and, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { categories, transactions } from "@/lib/db/schema";
import { eachDay, eachMonth } from "@/lib/period";

/**
 * Aggregations for charts. All sums are done by the database (SQL), and every query
 * is limited to the signed-in user's own rows.
 */

export type SeriesPoint = { date: string; income: number; expense: number };
export type Granularity = "day" | "month";

/**
 * Income and expense per day (or per month), with zeros for empty days so a chart line never breaks.
 * For a day the `date` is YYYY-MM-DD, for a month it is YYYY-MM.
 */
export async function incomeExpenseSeries(
  userId: string,
  from: string,
  to: string,
  granularity: Granularity,
): Promise<SeriesPoint[]> {
  const bucket =
    granularity === "month"
      ? sql<string>`substr(${transactions.occurredOn}, 1, 7)`
      : sql<string>`${transactions.occurredOn}`;

  const rows = await db
    .select({
      bucket: bucket.as("bucket"),
      type: transactions.type,
      total: sql<number>`sum(${transactions.amount})`.mapWith(Number),
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        gte(transactions.occurredOn, from),
        lte(transactions.occurredOn, to),
      ),
    )
    .groupBy(sql`bucket`, transactions.type);

  const points = new Map<string, SeriesPoint>();
  const keys = granularity === "month" ? eachMonth(from, to) : eachDay(from, to);
  for (const k of keys) points.set(k, { date: k, income: 0, expense: 0 });
  for (const r of rows) {
    const p = points.get(r.bucket);
    if (p) p[r.type] = r.total;
  }
  return [...points.values()];
}

export type CategoryTotal = {
  categoryId: string;
  name: string;
  systemKey: string | null;
  color: string;
  total: number;
};

/** Expense (or income) per category for a period, biggest first. */
export async function totalsByCategory(
  userId: string,
  type: "expense" | "income",
  from: string,
  to: string,
): Promise<CategoryTotal[]> {
  return db
    .select({
      categoryId: categories.id,
      name: categories.name,
      systemKey: categories.systemKey,
      color: categories.color,
      total: sql<number>`sum(${transactions.amount})`.mapWith(Number),
    })
    .from(transactions)
    .innerJoin(categories, eq(categories.id, transactions.categoryId))
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.type, type),
        gte(transactions.occurredOn, from),
        lte(transactions.occurredOn, to),
      ),
    )
    .groupBy(categories.id)
    .orderBy(sql`sum(${transactions.amount}) desc`);
}

import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import type { SQLiteColumn } from "drizzle-orm/sqlite-core";
import { db } from "@/lib/db/client";
import { salaryBonuses, salaryRecords } from "@/lib/db/schema";
import type { Deduction, SalaryMode, SalaryResult } from "@/lib/salary";
import type { MonthTotals } from "@/lib/salary-stats";

/**
 * Every function takes the signed-in user's id and puts it in the WHERE clause,
 * so one user can never read or change another user's salary records.
 */

export type SalaryRecordValues = {
  currency: string;
  country: string | null;
  title: string | null;
  payDate: string;
  mode: SalaryMode;
  rate: number;
  quantity: number;
  monthHours: number;
  dayHours: number;
  overtimeHours: number;
  overtimeMultiplier: number;
  deductions: Deduction[];
  result: SalaryResult;
  bonuses: { label: string; amount: number }[];
};

export type SalaryRecordRow = {
  id: string;
  currency: string;
  title: string | null;
  payDate: string;
  mode: SalaryMode;
  rate: number;
  quantity: number;
  overtimeHours: number;
  basePay: number;
  overtimePay: number;
  bonusTotal: number;
  gross: number;
  deductionTotal: number;
  net: number;
  bonuses: { id: string; label: string; amount: number }[];
};

/** Saves a calculation together with its bonuses, all or nothing. Returns the new record's id. */
export async function insertSalaryRecord(userId: string, v: SalaryRecordValues): Promise<string> {
  const id = crypto.randomUUID();
  await db.batch([
    db.insert(salaryRecords).values({
      id,
      userId,
      currency: v.currency,
      country: v.country,
      title: v.title,
      payDate: v.payDate,
      mode: v.mode,
      rate: v.rate,
      quantity: v.quantity,
      monthHours: v.monthHours,
      dayHours: v.dayHours,
      overtimeHours: v.overtimeHours,
      overtimeMultiplier: v.overtimeMultiplier,
      deductions: JSON.stringify(v.deductions),
      basePay: v.result.basePay,
      overtimePay: v.result.overtimePay,
      bonusTotal: v.result.bonusTotal,
      gross: v.result.gross,
      deductionTotal: v.result.deductionTotal,
      net: v.result.net,
    }),
    ...v.bonuses.map((b) =>
      db.insert(salaryBonuses).values({ userId, recordId: id, label: b.label, amount: b.amount }),
    ),
  ]);
  return id;
}

/** The user's saved calculations, newest pay date first, each with its bonuses. */
export async function listSalaryRecords(
  userId: string,
  limit = 60,
  /** Only records paid between these dates (YYYY-MM-DD, inclusive). */
  range?: { from: string; to: string },
): Promise<SalaryRecordRow[]> {
  const rows = await db
    .select({
      id: salaryRecords.id,
      currency: salaryRecords.currency,
      title: salaryRecords.title,
      payDate: salaryRecords.payDate,
      mode: salaryRecords.mode,
      rate: salaryRecords.rate,
      quantity: salaryRecords.quantity,
      overtimeHours: salaryRecords.overtimeHours,
      basePay: salaryRecords.basePay,
      overtimePay: salaryRecords.overtimePay,
      bonusTotal: salaryRecords.bonusTotal,
      gross: salaryRecords.gross,
      deductionTotal: salaryRecords.deductionTotal,
      net: salaryRecords.net,
    })
    .from(salaryRecords)
    .where(
      range
        ? and(eq(salaryRecords.userId, userId), gte(salaryRecords.payDate, range.from), lte(salaryRecords.payDate, range.to))
        : eq(salaryRecords.userId, userId),
    )
    .orderBy(desc(salaryRecords.payDate), desc(salaryRecords.createdAt))
    .limit(limit);
  if (rows.length === 0) return [];

  const bonuses = await db
    .select({
      id: salaryBonuses.id,
      recordId: salaryBonuses.recordId,
      label: salaryBonuses.label,
      amount: salaryBonuses.amount,
    })
    .from(salaryBonuses)
    .where(eq(salaryBonuses.userId, userId))
    .orderBy(salaryBonuses.createdAt);

  return rows.map((r) => ({
    ...r,
    bonuses: bonuses.filter((b) => b.recordId === r.id).map(({ id, label, amount }) => ({ id, label, amount })),
  }));
}

/**
 * Totals per calendar month of the pay date, for records in one currency, from `fromMonth` (YYYY-MM) on.
 * Months without records are left out; the caller fills the gaps.
 */
export async function salaryMonthlyTotals(
  userId: string,
  currency: string,
  fromMonth: string,
): Promise<MonthTotals[]> {
  const month = sql<string>`substr(${salaryRecords.payDate}, 1, 7)`;
  const total = (col: SQLiteColumn) => sql<number>`coalesce(sum(${col}), 0)`.mapWith(Number);
  return db
    .select({
      month,
      gross: total(salaryRecords.gross),
      net: total(salaryRecords.net),
      bonus: total(salaryRecords.bonusTotal),
      deductions: total(salaryRecords.deductionTotal),
      overtime: total(salaryRecords.overtimePay),
      count: sql<number>`count(*)`.mapWith(Number),
    })
    .from(salaryRecords)
    .where(
      and(
        eq(salaryRecords.userId, userId),
        eq(salaryRecords.currency, currency),
        gte(salaryRecords.payDate, `${fromMonth}-01`),
      ),
    )
    .groupBy(month)
    .orderBy(month);
}

export async function deleteSalaryRecord(userId: string, id: string) {
  const res = await db
    .delete(salaryRecords)
    .where(and(eq(salaryRecords.id, id), eq(salaryRecords.userId, userId)));
  return res.rowsAffected > 0;
}

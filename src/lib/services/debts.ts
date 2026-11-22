import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { debtPayments, debts } from "@/lib/db/schema";
import type { DebtDirection, DebtKind } from "@/lib/debts";

/**
 * Every function takes the signed-in user's id and puts it in the WHERE clause,
 * so one user can never read or change another user's debts.
 */

export type DebtRow = {
  id: string;
  name: string;
  direction: DebtDirection;
  kind: DebtKind;
  currency: string;
  principal: number;
  interestRate: number;
  monthlyPayment: number | null;
  paymentDay: number | null;
  note: string | null;
  /** Sum of the payments so far, minor units of the debt's currency. */
  paid: number;
};

export type DebtValues = Omit<DebtRow, "id" | "paid">;

export type PaymentRow = { id: string; debtId: string; paidOn: string; amount: number; note: string | null };

/** Hard limits per user, so the lists stay small. */
export const MAX_DEBTS = 50;
export const MAX_PAYMENTS_LISTED = 1000;

export async function listDebts(userId: string): Promise<DebtRow[]> {
  return db
    .select({
      id: debts.id,
      name: debts.name,
      direction: debts.direction,
      kind: debts.kind,
      currency: debts.currency,
      principal: debts.principal,
      interestRate: debts.interestRate,
      monthlyPayment: debts.monthlyPayment,
      paymentDay: debts.paymentDay,
      note: debts.note,
      paid: sql<number>`coalesce(sum(${debtPayments.amount}), 0)`.mapWith(Number),
    })
    .from(debts)
    .leftJoin(debtPayments, and(eq(debtPayments.debtId, debts.id), eq(debtPayments.userId, debts.userId)))
    .where(eq(debts.userId, userId))
    .groupBy(debts.id)
    .orderBy(asc(debts.createdAt));
}

export async function getDebt(userId: string, id: string): Promise<DebtRow | null> {
  return (await listDebts(userId)).find((d) => d.id === id) ?? null;
}

export async function insertDebt(userId: string, v: DebtValues): Promise<string> {
  const [row] = await db.insert(debts).values({ ...v, userId }).returning({ id: debts.id });
  return row.id;
}

/** The currency is not changed after creation: the payments were made in it. */
export async function updateDebt(userId: string, id: string, v: Omit<DebtValues, "currency">): Promise<boolean> {
  const res = await db.update(debts).set(v).where(and(eq(debts.id, id), eq(debts.userId, userId)));
  return res.rowsAffected > 0;
}

export async function deleteDebt(userId: string, id: string): Promise<boolean> {
  const res = await db.delete(debts).where(and(eq(debts.id, id), eq(debts.userId, userId)));
  return res.rowsAffected > 0;
}

/** The newest payments of all debts (the page groups them per debt). */
export async function listPayments(userId: string): Promise<PaymentRow[]> {
  return db
    .select({
      id: debtPayments.id,
      debtId: debtPayments.debtId,
      paidOn: debtPayments.paidOn,
      amount: debtPayments.amount,
      note: debtPayments.note,
    })
    .from(debtPayments)
    .where(eq(debtPayments.userId, userId))
    .orderBy(desc(debtPayments.paidOn), desc(debtPayments.createdAt))
    .limit(MAX_PAYMENTS_LISTED);
}

export async function insertPayment(userId: string, debtId: string, paidOn: string, amount: number, note: string | null) {
  const [row] = await db
    .insert(debtPayments)
    .values({ userId, debtId, paidOn, amount, note })
    .returning({ id: debtPayments.id });
  return row.id;
}

export async function deletePayment(userId: string, id: string): Promise<boolean> {
  const res = await db.delete(debtPayments).where(and(eq(debtPayments.id, id), eq(debtPayments.userId, userId)));
  return res.rowsAffected > 0;
}

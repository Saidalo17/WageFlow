"use server";

import { revalidatePath } from "next/cache";
import { minorDigits } from "@/lib/money";
import {
  deleteDebt,
  deletePayment,
  getDebt,
  insertDebt,
  insertPayment,
  listDebts,
  MAX_DEBTS,
  updateDebt,
} from "@/lib/services/debts";
import { getCurrentUser } from "@/lib/session";
import { debtPaymentSchema, debtSchema, financeIdSchema, updateDebtSchema } from "@/lib/validators/finance";
import { MAX_AMOUNT_MAJOR } from "@/lib/validators/transaction";

export type ActionResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

function fieldErrorsOf(issues: { path: PropertyKey[]; message: string }[]) {
  const out: Record<string, string> = {};
  for (const i of issues) out[String(i.path[0] ?? "form")] ??= i.message;
  return out;
}

const tooLarge = (minor: number, currency: string) => minor > MAX_AMOUNT_MAJOR * 10 ** minorDigits(currency);

/** Creates a debt (id = null) or changes one. The currency can only be chosen when creating. */
export async function saveDebt(id: unknown, input: unknown): Promise<ActionResult> {
  const user = await getCurrentUser();

  if (id === null) {
    const parsed = debtSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "invalid", fieldErrors: fieldErrorsOf(parsed.error.issues) };
    const v = parsed.data;
    if (tooLarge(v.principal, v.currency) || (v.monthlyPayment !== null && tooLarge(v.monthlyPayment, v.currency))) {
      return { ok: false, error: "invalid", fieldErrors: { principal: "amountTooLarge" } };
    }
    if ((await listDebts(user.id)).length >= MAX_DEBTS) return { ok: false, error: "tooMany" };
    await insertDebt(user.id, v);
  } else {
    const idParsed = financeIdSchema.safeParse(id);
    if (!idParsed.success) return { ok: false, error: "generic" };
    const parsed = updateDebtSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "invalid", fieldErrors: fieldErrorsOf(parsed.error.issues) };
    const existing = await getDebt(user.id, idParsed.data);
    if (!existing) return { ok: false, error: "notFound" };
    const v = parsed.data;
    if (tooLarge(v.principal, existing.currency) || (v.monthlyPayment !== null && tooLarge(v.monthlyPayment, existing.currency))) {
      return { ok: false, error: "invalid", fieldErrors: { principal: "amountTooLarge" } };
    }
    await updateDebt(user.id, existing.id, v);
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function removeDebt(id: unknown): Promise<ActionResult> {
  const user = await getCurrentUser();
  const idParsed = financeIdSchema.safeParse(id);
  if (!idParsed.success) return { ok: false, error: "generic" };
  if (!(await deleteDebt(user.id, idParsed.data))) return { ok: false, error: "notFound" };
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Records a payment on a debt the user owns. The amount is in the debt's currency. */
export async function addDebtPayment(input: unknown): Promise<ActionResult> {
  const user = await getCurrentUser();
  const parsed = debtPaymentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid", fieldErrors: fieldErrorsOf(parsed.error.issues) };
  const v = parsed.data;

  const debt = await getDebt(user.id, v.debtId);
  if (!debt) return { ok: false, error: "notFound" };
  if (tooLarge(v.amount, debt.currency)) return { ok: false, error: "invalid", fieldErrors: { amount: "amountTooLarge" } };

  await insertPayment(user.id, debt.id, v.paidOn, v.amount, v.note);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function removeDebtPayment(id: unknown): Promise<ActionResult> {
  const user = await getCurrentUser();
  const idParsed = financeIdSchema.safeParse(id);
  if (!idParsed.success) return { ok: false, error: "generic" };
  if (!(await deletePayment(user.id, idParsed.data))) return { ok: false, error: "notFound" };
  revalidatePath("/", "layout");
  return { ok: true };
}

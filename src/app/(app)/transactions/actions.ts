"use server";

import { revalidatePath } from "next/cache";
import { isForeignKeyViolation } from "@/lib/db/errors";
import { minorDigits } from "@/lib/money";
import { getCategory } from "@/lib/services/categories";
import {
  deleteTransactionRow,
  getTransaction,
  insertTransaction,
  updateTransactionRow,
} from "@/lib/services/transactions";
import { getCurrentUser } from "@/lib/session";
import {
  idSchema,
  MAX_AMOUNT_MAJOR,
  restoreSchema,
  transactionSchema,
  type TransactionValues,
} from "@/lib/validators/transaction";

export type ActionResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

function fieldErrorsOf(issues: { path: PropertyKey[]; message: string }[]) {
  const out: Record<string, string> = {};
  for (const i of issues) out[String(i.path[0] ?? "form")] ??= i.message;
  return out;
}

/** Checks that depend on the database: the category is the user's, matches the type, and the amount fits. */
async function checkRules(
  userId: string,
  currency: string,
  values: TransactionValues,
  keepCategoryId?: string,
): Promise<ActionResult> {
  if (values.amount > MAX_AMOUNT_MAJOR * 10 ** minorDigits(currency)) {
    return { ok: false, error: "invalid", fieldErrors: { amount: "amountTooLarge" } };
  }
  const category = await getCategory(userId, values.categoryId);
  if (!category) {
    return { ok: false, error: "invalid", fieldErrors: { categoryId: "categoryRequired" } };
  }
  if (category.type !== values.type) {
    return { ok: false, error: "invalid", fieldErrors: { categoryId: "typeMismatch" } };
  }
  // An archived category can't get new transactions, but an old transaction may keep it.
  if (category.isArchived && category.id !== keepCategoryId) {
    return { ok: false, error: "invalid", fieldErrors: { categoryId: "categoryArchived" } };
  }
  return { ok: true };
}

export async function createTransaction(input: unknown): Promise<ActionResult> {
  const user = await getCurrentUser();
  const parsed = transactionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "invalid", fieldErrors: fieldErrorsOf(parsed.error.issues) };
  }
  const rules = await checkRules(user.id, user.currency, parsed.data);
  if (!rules.ok) return rules;

  try {
    await insertTransaction(user.id, parsed.data);
  } catch (e) {
    console.error("createTransaction failed", e instanceof Error ? e.message : e);
    return { ok: false, error: "generic" };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateTransaction(id: unknown, input: unknown): Promise<ActionResult> {
  const user = await getCurrentUser();
  const idParsed = idSchema.safeParse(id);
  if (!idParsed.success) return { ok: false, error: "generic" };
  const parsed = transactionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "invalid", fieldErrors: fieldErrorsOf(parsed.error.issues) };
  }

  const existing = await getTransaction(user.id, idParsed.data);
  if (!existing) return { ok: false, error: "notFound" };

  const rules = await checkRules(user.id, user.currency, parsed.data, existing.categoryId);
  if (!rules.ok) return rules;

  try {
    await updateTransactionRow(user.id, existing.id, parsed.data);
  } catch (e) {
    console.error("updateTransaction failed", e instanceof Error ? e.message : e);
    return { ok: false, error: "generic" };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteTransaction(id: unknown): Promise<ActionResult> {
  const user = await getCurrentUser();
  const idParsed = idSchema.safeParse(id);
  if (!idParsed.success) return { ok: false, error: "generic" };
  const done = await deleteTransactionRow(user.id, idParsed.data);
  if (!done) return { ok: false, error: "notFound" };
  revalidatePath("/", "layout");
  return { ok: true };
}

/** "Undo" after a delete: puts the transaction back with the same id. */
export async function restoreTransaction(input: unknown): Promise<ActionResult> {
  const user = await getCurrentUser();
  const parsed = restoreSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "generic" };
  const { id, ...values } = parsed.data;

  const rules = await checkRules(user.id, user.currency, values, values.categoryId);
  if (!rules.ok) return rules;

  try {
    await insertTransaction(user.id, values, id);
  } catch (e) {
    if (isForeignKeyViolation(e)) return { ok: false, error: "notFound" };
    console.error("restoreTransaction failed", e instanceof Error ? e.message : e);
    return { ok: false, error: "generic" };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

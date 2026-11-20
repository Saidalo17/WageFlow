"use server";

import { revalidatePath } from "next/cache";
import { isForeignKeyViolation } from "@/lib/db/errors";
import { convertMinor, getRate, RatesUnavailableError } from "@/lib/fx";
import { isValidCurrency } from "@/lib/currencies";
import { minorDigits } from "@/lib/money";
import { getCategory } from "@/lib/services/categories";
import {
  deleteTransactionRow,
  getTransaction,
  insertTransaction,
  updateTransactionRow,
  type StoredTransaction,
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

/**
 * Checks that depend on the database (the category is the user's, matches the type, the amount fits)
 * and converts the amount into the user's currency when another currency was typed.
 */
async function prepare(
  userId: string,
  userCurrency: string,
  values: TransactionValues,
  keepCategoryId?: string,
): Promise<{ ok: true; stored: StoredTransaction } | Extract<ActionResult, { ok: false }>> {
  const currency = values.currency ?? userCurrency;
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

  let amount = values.amount;
  if (currency !== userCurrency) {
    try {
      const rate = await getRate(currency, userCurrency, values.occurredOn);
      amount = convertMinor(values.amount, currency, userCurrency, rate);
    } catch (e) {
      if (e instanceof RatesUnavailableError) return { ok: false, error: "ratesUnavailable" };
      throw e;
    }
    if (amount > MAX_AMOUNT_MAJOR * 10 ** minorDigits(userCurrency)) {
      return { ok: false, error: "invalid", fieldErrors: { amount: "amountTooLarge" } };
    }
  }
  return {
    ok: true,
    stored: {
      type: values.type,
      categoryId: values.categoryId,
      amount,
      originalAmount: values.amount,
      originalCurrency: currency,
      occurredOn: values.occurredOn,
      note: values.note,
    },
  };
}

/** Rate for the "≈ amount" preview in the form: units of the user's currency per 1 unit of `from`. */
export async function getConversionRate(
  from: unknown,
  date: unknown,
  to?: unknown,
): Promise<{ ok: true; rate: number } | { ok: false }> {
  const user = await getCurrentUser();
  if (typeof from !== "string" || !isValidCurrency(from)) return { ok: false };
  // The preview is shown in the currency the user is looking at (the display currency), the main one by default.
  const target = typeof to === "string" && isValidCurrency(to) ? to : user.currency;
  const day = typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined;
  try {
    return { ok: true, rate: await getRate(from, target, day) };
  } catch {
    return { ok: false };
  }
}

export async function createTransaction(input: unknown): Promise<ActionResult> {
  const user = await getCurrentUser();
  const parsed = transactionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "invalid", fieldErrors: fieldErrorsOf(parsed.error.issues) };
  }
  const prepared = await prepare(user.id, user.currency, parsed.data);
  if (!prepared.ok) return prepared;

  try {
    await insertTransaction(user.id, prepared.stored);
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

  const prepared = await prepare(user.id, user.currency, parsed.data, existing.categoryId);
  if (!prepared.ok) return prepared;

  try {
    await updateTransactionRow(user.id, existing.id, prepared.stored);
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

  const prepared = await prepare(user.id, user.currency, values, values.categoryId);
  if (!prepared.ok) return prepared;

  try {
    await insertTransaction(user.id, prepared.stored, id);
  } catch (e) {
    if (isForeignKeyViolation(e)) return { ok: false, error: "notFound" };
    console.error("restoreTransaction failed", e instanceof Error ? e.message : e);
    return { ok: false, error: "generic" };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

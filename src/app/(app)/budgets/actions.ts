"use server";

import { revalidatePath } from "next/cache";
import { isForeignKeyViolation, isUniqueViolation } from "@/lib/db/errors";
import { convertMinor, getRate, RatesUnavailableError } from "@/lib/fx";
import { minorDigits } from "@/lib/money";
import {
  deleteBudgetRow,
  getBudget,
  insertBudget,
  updateBudgetLimit,
} from "@/lib/services/budgets";
import { getCategory } from "@/lib/services/categories";
import { getCurrentUser } from "@/lib/session";
import { budgetIdSchema, createBudgetSchema, updateBudgetSchema } from "@/lib/validators/budget";
import { MAX_AMOUNT_MAJOR } from "@/lib/validators/transaction";

export type ActionResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

function fieldErrorsOf(issues: { path: PropertyKey[]; message: string }[]) {
  const out: Record<string, string> = {};
  for (const i of issues) out[String(i.path[0] ?? "form")] ??= i.message;
  return out;
}

const tooLarge = (limit: number, currency: string) =>
  limit > MAX_AMOUNT_MAJOR * 10 ** minorDigits(currency);

/** The limit may be typed in the display currency; it is stored in the main currency. */
async function toMainCurrency(
  limit: number,
  typedIn: string | undefined,
  main: string,
): Promise<{ ok: true; limit: number } | ActionResult> {
  if (!typedIn || typedIn === main) return { ok: true, limit };
  try {
    return { ok: true, limit: convertMinor(limit, typedIn, main, await getRate(typedIn, main)) };
  } catch (e) {
    if (e instanceof RatesUnavailableError) return { ok: false, error: "ratesUnavailable" };
    throw e;
  }
}

export async function createBudget(input: unknown): Promise<ActionResult> {
  const user = await getCurrentUser();
  const parsed = createBudgetSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "invalid", fieldErrors: fieldErrorsOf(parsed.error.issues) };
  }
  const { categoryId } = parsed.data;
  if (tooLarge(parsed.data.limit, parsed.data.currency ?? user.currency)) {
    return { ok: false, error: "invalid", fieldErrors: { limit: "amountTooLarge" } };
  }
  const converted = await toMainCurrency(parsed.data.limit, parsed.data.currency, user.currency);
  if (!converted.ok || !("limit" in converted)) return converted as ActionResult;
  const limit = converted.limit;
  if (tooLarge(limit, user.currency)) {
    return { ok: false, error: "invalid", fieldErrors: { limit: "amountTooLarge" } };
  }

  // Only the user's own, active expense categories can have a limit.
  const category = await getCategory(user.id, categoryId);
  if (!category || category.type !== "expense" || category.isArchived) {
    return { ok: false, error: "invalid", fieldErrors: { categoryId: "categoryRequired" } };
  }

  try {
    await insertBudget(user.id, categoryId, limit);
  } catch (e) {
    if (isUniqueViolation(e)) {
      return { ok: false, error: "invalid", fieldErrors: { categoryId: "exists" } };
    }
    if (isForeignKeyViolation(e)) return { ok: false, error: "notFound" };
    console.error("createBudget failed", e instanceof Error ? e.message : e);
    return { ok: false, error: "generic" };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateBudget(id: unknown, input: unknown): Promise<ActionResult> {
  const user = await getCurrentUser();
  const idParsed = budgetIdSchema.safeParse(id);
  if (!idParsed.success) return { ok: false, error: "generic" };
  const parsed = updateBudgetSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "invalid", fieldErrors: fieldErrorsOf(parsed.error.issues) };
  }
  if (tooLarge(parsed.data.limit, parsed.data.currency ?? user.currency)) {
    return { ok: false, error: "invalid", fieldErrors: { limit: "amountTooLarge" } };
  }
  const converted = await toMainCurrency(parsed.data.limit, parsed.data.currency, user.currency);
  if (!converted.ok || !("limit" in converted)) return converted as ActionResult;
  if (tooLarge(converted.limit, user.currency)) {
    return { ok: false, error: "invalid", fieldErrors: { limit: "amountTooLarge" } };
  }

  const existing = await getBudget(user.id, idParsed.data);
  if (!existing) return { ok: false, error: "notFound" };

  await updateBudgetLimit(user.id, existing.id, converted.limit);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteBudget(id: unknown): Promise<ActionResult> {
  const user = await getCurrentUser();
  const idParsed = budgetIdSchema.safeParse(id);
  if (!idParsed.success) return { ok: false, error: "generic" };
  const done = await deleteBudgetRow(user.id, idParsed.data);
  if (!done) return { ok: false, error: "notFound" };
  revalidatePath("/", "layout");
  return { ok: true };
}

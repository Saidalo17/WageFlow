"use server";

import { revalidatePath } from "next/cache";
import { minorDigits } from "@/lib/money";
import {
  deleteAccount,
  getAccount,
  insertAccount,
  listAccountOptions,
  MAX_ACCOUNTS,
  setOpeningBalance,
  updateAccount,
} from "@/lib/services/accounts";
import { getCurrentUser } from "@/lib/session";
import { accountSchema, financeIdSchema, setBalanceSchema, updateAccountSchema } from "@/lib/validators/finance";
import { MAX_AMOUNT_MAJOR } from "@/lib/validators/transaction";

export type ActionResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

function fieldErrorsOf(issues: { path: PropertyKey[]; message: string }[]) {
  const out: Record<string, string> = {};
  for (const i of issues) out[String(i.path[0] ?? "form")] ??= i.message;
  return out;
}

const tooLarge = (minor: number, currency: string) => Math.abs(minor) > MAX_AMOUNT_MAJOR * 10 ** minorDigits(currency);

/** Creates an account (id = null) or changes one. The currency can only be chosen when creating. */
export async function saveAccount(id: unknown, input: unknown): Promise<ActionResult> {
  const user = await getCurrentUser();

  if (id === null) {
    const parsed = accountSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "invalid", fieldErrors: fieldErrorsOf(parsed.error.issues) };
    if (tooLarge(parsed.data.openingBalance, parsed.data.currency)) {
      return { ok: false, error: "invalid", fieldErrors: { openingBalance: "amountTooLarge" } };
    }
    if ((await listAccountOptions(user.id)).length >= MAX_ACCOUNTS) return { ok: false, error: "tooMany" };
    await insertAccount(user.id, parsed.data);
  } else {
    const idParsed = financeIdSchema.safeParse(id);
    if (!idParsed.success) return { ok: false, error: "generic" };
    const parsed = updateAccountSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "invalid", fieldErrors: fieldErrorsOf(parsed.error.issues) };
    const existing = (await listAccountOptions(user.id)).find((a) => a.id === idParsed.data);
    if (!existing) return { ok: false, error: "notFound" };
    if (tooLarge(parsed.data.openingBalance, existing.currency)) {
      return { ok: false, error: "invalid", fieldErrors: { openingBalance: "amountTooLarge" } };
    }
    await updateAccount(user.id, existing.id, parsed.data);
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * "The account really has this much now": the opening balance is set so that the opening balance plus
 * the linked transactions comes to exactly that.
 */
export async function setAccountBalance(id: unknown, input: unknown): Promise<ActionResult> {
  const user = await getCurrentUser();
  const idParsed = financeIdSchema.safeParse(id);
  if (!idParsed.success) return { ok: false, error: "generic" };
  const parsed = setBalanceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid", fieldErrors: fieldErrorsOf(parsed.error.issues) };

  const account = await getAccount(user.id, idParsed.data);
  if (!account) return { ok: false, error: "notFound" };
  if (tooLarge(parsed.data.balance, account.currency)) {
    return { ok: false, error: "invalid", fieldErrors: { balance: "amountTooLarge" } };
  }
  await setOpeningBalance(user.id, account.id, parsed.data.balance - account.linked);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function removeAccount(id: unknown): Promise<ActionResult> {
  const user = await getCurrentUser();
  const idParsed = financeIdSchema.safeParse(id);
  if (!idParsed.success) return { ok: false, error: "generic" };
  const done = await deleteAccount(user.id, idParsed.data);
  if (!done) return { ok: false, error: "notFound" };
  revalidatePath("/", "layout");
  return { ok: true };
}

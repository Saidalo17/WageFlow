"use server";

import { revalidatePath } from "next/cache";
import { calculateWithTaxes } from "@/lib/salary-tax";
import { minorDigits } from "@/lib/money";
import { listCategories } from "@/lib/services/categories";
import { deleteSalaryRecord, insertSalaryRecord } from "@/lib/services/salary";
import { insertTransaction } from "@/lib/services/transactions";
import { getCurrentUser } from "@/lib/session";
import { salaryIdSchema, salaryRecordSchema } from "@/lib/validators/salary";
import { MAX_AMOUNT_MAJOR } from "@/lib/validators/transaction";

export type ActionResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

function fieldErrorsOf(issues: { path: PropertyKey[]; message: string }[]) {
  const out: Record<string, string> = {};
  for (const i of issues) out[String(i.path[0] ?? "form")] ??= i.message;
  return out;
}

/**
 * Saves a calculation. The result is calculated again here from the inputs, so the stored numbers
 * never depend on what the browser computed. Amounts are in the user's main currency.
 */
export async function saveSalaryRecord(input: unknown): Promise<ActionResult> {
  const user = await getCurrentUser();
  const parsed = salaryRecordSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "invalid", fieldErrors: fieldErrorsOf(parsed.error.issues) };
  }
  const v = parsed.data;

  const { result, currencyMismatch } = calculateWithTaxes(
    {
      mode: v.mode,
      rate: v.rate,
      quantity: v.quantity,
      monthHours: v.monthHours,
      dayHours: v.dayHours,
      overtimeHours: v.overtimeHours,
      overtimeMultiplier: v.overtimeMultiplier,
      bonuses: v.bonuses.map((b) => b.amount),
      deductions: v.deductions,
    },
    v.country,
    user.currency,
  );
  if (currencyMismatch) return { ok: false, error: "countryCurrency" };

  const limit = MAX_AMOUNT_MAJOR * 10 ** minorDigits(user.currency);
  if (result.gross > limit || v.rate > limit) {
    return { ok: false, error: "invalid", fieldErrors: { rate: "amountTooLarge" } };
  }
  if (result.gross <= 0) return { ok: false, error: "nothingToSave" };
  if (result.net < 0) return { ok: false, error: "deductionsExceed" };

  try {
    await insertSalaryRecord(user.id, {
      currency: user.currency,
      country: v.country,
      title: v.title,
      payDate: v.payDate,
      mode: v.mode,
      rate: v.rate,
      quantity: v.mode === "monthly" ? 0 : v.quantity,
      monthHours: v.monthHours,
      dayHours: v.dayHours,
      overtimeHours: v.overtimeHours,
      overtimeMultiplier: v.overtimeMultiplier,
      // Taxes from the country rules come first, then the hand-entered deductions, as they were calculated.
      deductions: result.deductions.map(({ label, kind, value }) => ({ label, kind, value })),
      result,
      bonuses: v.bonuses,
    });
  } catch (e) {
    console.error("saveSalaryRecord failed", e instanceof Error ? e.message : e);
    return { ok: false, error: "generic" };
  }

  // Optionally record the net pay as income, under "Salary" (or the first active income category).
  if (v.addToIncome && result.net > 0) {
    const income = (await listCategories(user.id)).filter((c) => c.type === "income" && !c.isArchived);
    const category = income.find((c) => c.systemKey === "salary") ?? income[0];
    if (category) {
      try {
        await insertTransaction(user.id, {
          type: "income",
          categoryId: category.id,
          amount: result.net,
          occurredOn: v.payDate,
          note: v.title,
        });
      } catch (e) {
        console.error("saveSalaryRecord income failed", e instanceof Error ? e.message : e);
        revalidatePath("/", "layout");
        return { ok: false, error: "incomeFailed" };
      }
    }
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function removeSalaryRecord(id: unknown): Promise<ActionResult> {
  const user = await getCurrentUser();
  const idParsed = salaryIdSchema.safeParse(id);
  if (!idParsed.success) return { ok: false, error: "generic" };
  const done = await deleteSalaryRecord(user.id, idParsed.data);
  if (!done) return { ok: false, error: "notFound" };
  revalidatePath("/", "layout");
  return { ok: true };
}

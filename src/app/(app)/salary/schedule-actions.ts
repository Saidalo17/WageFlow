"use server";

import { revalidatePath } from "next/cache";
import { minorDigits } from "@/lib/money";
import {
  deleteSchedule,
  insertSchedule,
  listSchedules,
  MAX_SCHEDULES,
  updateSchedule,
} from "@/lib/services/schedules";
import { getCurrentUser } from "@/lib/session";
import { salaryIdSchema } from "@/lib/validators/salary";
import { scheduleSchema } from "@/lib/validators/schedule";
import { MAX_AMOUNT_MAJOR } from "@/lib/validators/transaction";

export type ActionResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

function fieldErrorsOf(issues: { path: PropertyKey[]; message: string }[]) {
  const out: Record<string, string> = {};
  for (const i of issues) out[String(i.path[0] ?? "form")] ??= i.message;
  return out;
}

/** Creates a pay schedule (id = null) or changes one. Amounts are in the user's main currency. */
export async function saveSchedule(id: unknown, input: unknown): Promise<ActionResult> {
  const user = await getCurrentUser();
  const parsed = scheduleSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "invalid", fieldErrors: fieldErrorsOf(parsed.error.issues) };
  }
  const v = parsed.data;
  if (v.expectedNet > MAX_AMOUNT_MAJOR * 10 ** minorDigits(user.currency)) {
    return { ok: false, error: "invalid", fieldErrors: { expectedNet: "amountTooLarge" } };
  }
  const values = {
    currency: user.currency,
    title: v.title,
    frequency: v.frequency,
    dayOfMonth: v.dayOfMonth,
    // The date only matters for weekly and every-two-weeks schedules.
    anchorDate: v.frequency === "monthly" ? null : v.anchorDate,
    expectedNet: v.expectedNet,
    remindDaysBefore: v.remindDaysBefore,
    isActive: v.isActive,
  };

  try {
    if (id === null) {
      if ((await listSchedules(user.id)).length >= MAX_SCHEDULES) return { ok: false, error: "tooMany" };
      await insertSchedule(user.id, values);
    } else {
      const idParsed = salaryIdSchema.safeParse(id);
      if (!idParsed.success) return { ok: false, error: "generic" };
      // Editing keeps the currency the schedule was made in.
      const existing = (await listSchedules(user.id)).find((s) => s.id === idParsed.data);
      if (!existing) return { ok: false, error: "notFound" };
      await updateSchedule(user.id, existing.id, { ...values, currency: existing.currency });
    }
  } catch (e) {
    console.error("saveSchedule failed", e instanceof Error ? e.message : e);
    return { ok: false, error: "generic" };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function removeSchedule(id: unknown): Promise<ActionResult> {
  const user = await getCurrentUser();
  const idParsed = salaryIdSchema.safeParse(id);
  if (!idParsed.success) return { ok: false, error: "generic" };
  const done = await deleteSchedule(user.id, idParsed.data);
  if (!done) return { ok: false, error: "notFound" };
  revalidatePath("/", "layout");
  return { ok: true };
}

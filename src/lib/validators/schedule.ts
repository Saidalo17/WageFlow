import { z } from "zod";
import { isRealDate } from "@/lib/period";
import { FREQUENCIES } from "@/lib/salary-schedule";

/** Error messages are translation keys (salary.schedule.errors.<key>). */

export const scheduleSchema = z
  .object({
    title: z.string().trim().min(1, { error: "titleRequired" }).max(60, { error: "titleLong" }),
    frequency: z.enum(FREQUENCIES, { error: "generic" }),
    dayOfMonth: z.number({ error: "dayInvalid" }).int({ error: "dayInvalid" }).min(1, { error: "dayInvalid" }).max(31, { error: "dayInvalid" }),
    /** Needed for weekly and every-two-weeks schedules. */
    anchorDate: z
      .string()
      .refine((s) => s === "" || isRealDate(s), { error: "dateInvalid" })
      .transform((s) => (s === "" ? null : s)),
    /** Expected net pay per payment, minor units of the user's currency. */
    expectedNet: z.number({ error: "amountInvalid" }).int({ error: "amountInvalid" }).positive({ error: "amountRequired" }),
    remindDaysBefore: z.number({ error: "remindInvalid" }).int({ error: "remindInvalid" }).min(0, { error: "remindInvalid" }).max(14, { error: "remindInvalid" }),
    isActive: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.frequency !== "monthly" && !v.anchorDate) {
      ctx.addIssue({ code: "custom", path: ["anchorDate"], message: "anchorRequired" });
    }
  });

export type ScheduleInput = z.input<typeof scheduleSchema>;

import { z } from "zod";
import { isRealDate } from "@/lib/period";
import { SALARY_MODES } from "@/lib/salary";
import { TAX_COUNTRIES } from "@/lib/tax";

/** Error messages are translation keys (salary.errors.<key>). */

const money = z
  .number({ error: "amountInvalid" })
  .int({ error: "amountInvalid" })
  .positive({ error: "amountRequired" });

const label = z.string().trim().min(1, { error: "labelRequired" }).max(60, { error: "labelLong" });

const hundredths = (max: number) =>
  z.number({ error: "numberInvalid" }).int({ error: "numberInvalid" }).min(0, { error: "numberInvalid" }).max(max, { error: "numberTooLarge" });

const deduction = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("percent"),
    label,
    /** Hundredths of a percent: 1300 = 13%. */
    value: z.number({ error: "numberInvalid" }).int({ error: "numberInvalid" }).positive({ error: "numberInvalid" }).max(10000, { error: "percentTooLarge" }),
  }),
  z.object({ kind: z.literal("fixed"), label, value: money }),
]);

export const salaryRecordSchema = z.object({
  mode: z.enum(SALARY_MODES),
  /** Monthly salary, hourly rate or daily rate, minor units of the user's currency. */
  rate: money,
  /** Hours (hourly) or days (daily) worked, hundredths. */
  quantity: hundredths(74400),
  monthHours: z.number().int().min(100, { error: "numberInvalid" }).max(74400, { error: "numberTooLarge" }),
  dayHours: z.number().int().min(100, { error: "numberInvalid" }).max(2400, { error: "numberTooLarge" }),
  overtimeHours: hundredths(74400),
  overtimeMultiplier: z.number().int().min(100, { error: "numberInvalid" }).max(500, { error: "numberTooLarge" }),
  bonuses: z.array(z.object({ label, amount: money })).max(20, { error: "tooMany" }),
  deductions: z.array(deduction).max(20, { error: "tooMany" }),
  /** Country whose tax rules are applied on top of the hand-entered deductions; null = none. */
  country: z.enum(TAX_COUNTRIES, { error: "generic" }).nullable(),
  payDate: z.string().refine(isRealDate, { error: "dateInvalid" }),
  title: z
    .string()
    .trim()
    .max(80, { error: "titleLong" })
    .transform((s) => (s === "" ? null : s)),
  /** Also record the net pay as an income transaction on the pay date. */
  addToIncome: z.boolean(),
});

export type SalaryRecordInput = z.infer<typeof salaryRecordSchema>;

export const salaryIdSchema = z.string().min(1).max(64);

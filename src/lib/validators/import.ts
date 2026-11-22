import { z } from "zod";
import { isRealDate } from "@/lib/period";

/** Error messages are translation keys (import.errors.<key>). */

const date = z
  .string()
  .refine(isRealDate, { error: "dateInvalid" })
  .refine((s) => s >= "1970-01-01" && s <= nextYear(), { error: "dateInvalid" });

function nextYear(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

/** Rows are sent in batches of at most this many, so one request stays small. */
export const IMPORT_BATCH = 500;

/** A row as read from the file: signed amount in minor units (negative = money out). */
export const analyzeRowSchema = z.object({
  date,
  description: z.string().max(300, { error: "invalid" }),
  amount: z
    .number({ error: "amountInvalid" })
    .int({ error: "amountInvalid" })
    .refine((n) => n !== 0, { error: "amountInvalid" }),
});
export const analyzeSchema = z.array(analyzeRowSchema).min(1, { error: "empty" }).max(IMPORT_BATCH, { error: "tooMany" });

/** A row the user confirmed. */
export const commitRowSchema = z.object({
  date,
  note: z
    .string()
    .trim()
    .max(200, { error: "invalid" })
    .transform((s) => (s === "" ? null : s)),
  /** Minor units, always positive; `type` says which way the money went. */
  amount: z.number({ error: "amountInvalid" }).int({ error: "amountInvalid" }).positive({ error: "amountInvalid" }),
  type: z.enum(["income", "expense"]),
  categoryId: z.string().min(1, { error: "categoryRequired" }).max(64),
  /** The account every row is linked to (optional). */
  accountId: z
    .string()
    .max(64)
    .nullable()
    .optional()
    .transform((s) => s || null),
});
export const commitSchema = z.array(commitRowSchema).min(1, { error: "empty" }).max(IMPORT_BATCH, { error: "tooMany" });

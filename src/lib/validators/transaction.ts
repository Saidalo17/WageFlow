import { z } from "zod";
import { isValidCurrency } from "@/lib/currencies";

/** Error messages are translation keys (transactions.errors.<key>). */

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { error: "dateInvalid" })
  .refine(
    (s) => {
      const [y, m, d] = s.split("-").map(Number);
      const dt = new Date(Date.UTC(y, m - 1, d));
      if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return false;
      // Not more than a year ahead.
      const limit = new Date();
      limit.setFullYear(limit.getFullYear() + 1);
      return dt.getTime() <= limit.getTime() && y >= 1970;
    },
    { error: "dateInvalid" },
  );

export const transactionSchema = z.object({
  type: z.enum(["income", "expense"]),
  categoryId: z.string().min(1, { error: "categoryRequired" }).max(64),
  /** The account the money moved on (optional). */
  accountId: z
    .string()
    .max(64)
    .nullable()
    .optional()
    .transform((s) => s || null),
  /** Minor units of `currency` (default: the user's currency); the upper bound is checked per currency on the server. */
  amount: z
    .number({ error: "amountInvalid" })
    .int({ error: "amountInvalid" })
    .positive({ error: "amountRequired" }),
  /** Currency of the amount. Leave out for the user's own currency; otherwise it is converted on save. */
  currency: z
    .string()
    .refine(isValidCurrency, { error: "currencyInvalid" })
    .optional(),
  occurredOn: isoDate,
  note: z
    .string()
    .trim()
    .max(200, { error: "noteLong" })
    .transform((s) => (s === "" ? null : s))
    .nullable()
    .optional()
    .transform((s) => s ?? null),
});

export type TransactionInput = z.input<typeof transactionSchema>;
export type TransactionValues = z.output<typeof transactionSchema>;

export const idSchema = z.string().min(1).max(64);

/** Snapshot used to put a deleted transaction back (the "Undo" button). */
export const restoreSchema = z.object({ id: idSchema }).and(transactionSchema);

export const MAX_AMOUNT_MAJOR = 999_999_999;

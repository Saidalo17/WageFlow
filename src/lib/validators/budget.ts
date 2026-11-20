import { z } from "zod";
import { isValidCurrency } from "@/lib/currencies";

/** Error messages are translation keys (budgets.errors.<key>). */
const limit = z
  .number({ error: "amountInvalid" })
  .int({ error: "amountInvalid" })
  .positive({ error: "amountRequired" });

/** Currency of the typed limit; left out = the user's main currency. */
const currency = z.string().refine(isValidCurrency, { error: "generic" }).optional();

export const createBudgetSchema = z.object({
  categoryId: z.string().min(1, { error: "categoryRequired" }).max(64),
  /** Monthly limit in minor units of the user's currency. */
  limit,
  currency,
});

export const updateBudgetSchema = z.object({ limit, currency });

export const budgetIdSchema = z.string().min(1).max(64);

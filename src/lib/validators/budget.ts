import { z } from "zod";

/** Error messages are translation keys (budgets.errors.<key>). */
const limit = z
  .number({ error: "amountInvalid" })
  .int({ error: "amountInvalid" })
  .positive({ error: "amountRequired" });

export const createBudgetSchema = z.object({
  categoryId: z.string().min(1, { error: "categoryRequired" }).max(64),
  /** Monthly limit in minor units of the user's currency. */
  limit,
});

export const updateBudgetSchema = z.object({ limit });

export const budgetIdSchema = z.string().min(1).max(64);

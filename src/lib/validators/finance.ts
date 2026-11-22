import { z } from "zod";
import { ACCOUNT_KINDS } from "@/lib/accounts";
import { isValidCurrency } from "@/lib/currencies";
import { DEBT_DIRECTIONS, DEBT_KINDS } from "@/lib/debts";
import { isRealDate } from "@/lib/period";

/** Error messages are translation keys (accounts.errors.<key>, debts.errors.<key>). */

const name = z.string().trim().min(1, { error: "nameRequired" }).max(60, { error: "nameLong" });
const currency = z.string().refine(isValidCurrency, { error: "currencyInvalid" });
const money = z.number({ error: "amountInvalid" }).int({ error: "amountInvalid" });
const positiveMoney = money.positive({ error: "amountRequired" });
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { error: "noteLong" })
    .nullable()
    .optional()
    .transform((s) => (s ? s : null));

const date = z
  .string()
  .refine(isRealDate, { error: "dateInvalid" })
  .refine((s) => s >= "1970-01-01" && s <= nextYear(), { error: "dateInvalid" });

function nextYear(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

// ---------- Accounts ----------

export const accountSchema = z.object({
  name,
  kind: z.enum(ACCOUNT_KINDS, { error: "generic" }),
  currency,
  /** What is on the account before the first linked transaction (can be negative, e.g. a credit card). */
  openingBalance: money,
  inNetWorth: z.boolean(),
  isArchived: z.boolean(),
});
export const updateAccountSchema = accountSchema.omit({ currency: true });

/** "My balance is really this": the opening balance is worked out from it. */
export const setBalanceSchema = z.object({ balance: money });

// ---------- Debts ----------

export const debtSchema = z.object({
  name,
  direction: z.enum(DEBT_DIRECTIONS, { error: "generic" }),
  kind: z.enum(DEBT_KINDS, { error: "generic" }),
  currency,
  principal: positiveMoney,
  /** Yearly interest in hundredths of a percent: 12.5% = 1250. */
  interestRate: z.number({ error: "rateInvalid" }).int({ error: "rateInvalid" }).min(0, { error: "rateInvalid" }).max(10_000, { error: "rateInvalid" }),
  monthlyPayment: positiveMoney.nullable(),
  paymentDay: z.number({ error: "dayInvalid" }).int({ error: "dayInvalid" }).min(1, { error: "dayInvalid" }).max(31, { error: "dayInvalid" }).nullable(),
  note: optionalText(200),
});
export const updateDebtSchema = debtSchema.omit({ currency: true });

export const debtPaymentSchema = z.object({
  debtId: z.string().min(1).max(64),
  paidOn: date,
  amount: positiveMoney,
  note: optionalText(120),
});

export const financeIdSchema = z.string().min(1).max(64);

export const snapshotDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(isRealDate);

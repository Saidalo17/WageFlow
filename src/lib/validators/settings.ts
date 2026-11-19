import { z } from "zod";
import { isValidCurrency } from "@/lib/currencies";
import { locales } from "@/i18n/config";

/** Error messages are translation keys (settings.errors.<key>). */

export const profileSchema = z.object({
  name: z.string().trim().max(60, { error: "nameLong" }),
  currency: z.string().refine(isValidCurrency, { error: "currencyInvalid" }),
  locale: z.enum(locales, { error: "generic" }),
  monthStartDay: z
    .number({ error: "dayInvalid" })
    .int({ error: "dayInvalid" })
    .min(1, { error: "dayInvalid" })
    .max(28, { error: "dayInvalid" }),
});

export const changePasswordSchema = z.object({
  current: z.string().min(1, { error: "required" }).max(72, { error: "passwordLong" }),
  next: z.string().min(8, { error: "passwordShort" }).max(72, { error: "passwordLong" }),
});

export const deleteAccountSchema = z.object({
  password: z.string().min(1, { error: "required" }).max(72, { error: "passwordLong" }),
});

export type ProfileValues = z.input<typeof profileSchema>;

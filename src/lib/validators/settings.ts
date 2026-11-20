import { z } from "zod";
import { isValidCurrency } from "@/lib/currencies";
import { locales } from "@/i18n/config";
import { HEX_COLOR } from "@/lib/category-meta";
import { BIO_MAX, PROFILE_EMOJIS } from "@/lib/profile-meta";

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

/** Profile decoration. Empty values mean "not set". */
export const decorationSchema = z.object({
  bio: z
    .string()
    .trim()
    .max(BIO_MAX, { error: "bioLong" })
    .transform((s) => (s === "" ? null : s)),
  emoji: z
    .string()
    .refine((e) => e === "" || (PROFILE_EMOJIS as readonly string[]).includes(e), { error: "generic" })
    .transform((e) => (e === "" ? null : e)),
  accent: z
    .string()
    .refine((c) => c === "" || HEX_COLOR.test(c), { error: "generic" })
    .transform((c) => (c === "" ? null : c.toUpperCase())),
});

export const changePasswordSchema = z.object({
  current: z.string().min(1, { error: "required" }).max(72, { error: "passwordLong" }),
  next: z.string().min(8, { error: "passwordShort" }).max(72, { error: "passwordLong" }),
});

export const deleteAccountSchema = z.object({
  password: z.string().min(1, { error: "required" }).max(72, { error: "passwordLong" }),
});

export type ProfileValues = z.input<typeof profileSchema>;

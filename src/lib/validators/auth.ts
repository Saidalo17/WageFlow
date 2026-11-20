import { z } from "zod";

/**
 * Error messages are translation keys (auth.errors.<key>),
 * translated where they are displayed.
 */
const email = z
  .string()
  .trim()
  .min(1, { error: "required" })
  .max(254, { error: "email" })
  .pipe(z.email({ error: "email" }));

export const loginSchema = z.object({
  email,
  password: z.string().min(1, { error: "required" }).max(72, { error: "passwordLong" }),
});

export const registerSchema = z.object({
  name: z.string().trim().max(60, { error: "nameLong" }),
  email,
  password: z
    .string()
    .min(8, { error: "passwordShort" })
    .max(72, { error: "passwordLong" }),
});

export const forgotSchema = z.object({ email });

export const resetSchema = z.object({
  token: z.string().min(1, { error: "resetInvalid" }).max(200, { error: "resetInvalid" }),
  password: z
    .string()
    .min(8, { error: "passwordShort" })
    .max(72, { error: "passwordLong" }),
});

export type LoginValues = z.infer<typeof loginSchema>;
export type RegisterValues = z.infer<typeof registerSchema>;

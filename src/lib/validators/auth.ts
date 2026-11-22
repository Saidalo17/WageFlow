import { z } from "zod";

/**
 * Error messages are translation keys (auth.errors.<key>, settings.errors.<key>),
 * translated where they are displayed. The same rules run in the browser (instant messages)
 * and again on the server (the browser is never trusted).
 */

// ---------- Email ----------

/** Top-level domains reserved for tests and private networks: no real mailbox can live there. */
const RESERVED_TLDS = ["test", "example", "invalid", "localhost", "local", "internal", "lan", "home", "corp", "onion"];
const RESERVED_DOMAINS = ["example.com", "example.net", "example.org"];

/** True for domains that can never receive real mail (example.com, *.test, localhost, ...). */
export function isReservedDomain(domain: string): boolean {
  const d = domain.toLowerCase();
  const tld = d.split(".").pop() ?? "";
  return RESERVED_TLDS.includes(tld) || RESERVED_DOMAINS.some((r) => d === r || d.endsWith(`.${r}`));
}

/**
 * Shape rules on top of a basic email check: lengths of each part, a domain with a real-looking last part
 * (letters only, 2 to 24 of them, or an internationalized "xn--" one), no stray hyphens or dots.
 */
export function isSensibleEmail(value: string): boolean {
  const at = value.lastIndexOf("@");
  if (at < 1) return false;
  const local = value.slice(0, at);
  const domain = value.slice(at + 1);
  if (local.length > 64 || /^\.|\.$|\.\./.test(local)) return false;
  const labels = domain.split(".");
  if (labels.length < 2) return false;
  if (!labels.every((l) => l.length >= 1 && l.length <= 63 && /^[a-z0-9-]+$/i.test(l) && !l.startsWith("-") && !l.endsWith("-"))) return false;
  const tld = labels[labels.length - 1];
  return /^[a-z]{2,24}$/i.test(tld) || /^xn--[a-z0-9-]{2,59}$/i.test(tld);
}

const email = z
  .string()
  .trim()
  .min(1, { error: "required" })
  .max(254, { error: "email" })
  .pipe(z.email({ error: "email" }))
  .refine(isSensibleEmail, { error: "email" });

// ---------- Password ----------

/** bcrypt only looks at the first 72 BYTES, so the limit is counted in bytes (a letter can take two or three). */
const byteLength = (s: string) => new TextEncoder().encode(s).length;

/** Passwords everybody tries first. Compared in lower case. */
const COMMON_PASSWORDS = new Set([
  "password", "password1", "password12", "password123", "password1234", "passw0rd", "p@ssw0rd", "p@ssword1",
  "12345678", "123456789", "1234567890", "12345678910", "123123123", "1q2w3e4r", "1q2w3e4r5t", "q1w2e3r4",
  "qwertyui", "qwerty12", "qwerty123", "qwerty1234", "qwerty12345", "qwertyuiop", "1qaz2wsx", "zaq12wsx", "qazwsxedc",
  "abc12345", "abcd1234", "abcdefgh", "a1b2c3d4", "admin123", "admin1234", "administrator", "letmein123", "welcome1",
  "welcome123", "iloveyou", "iloveyou1", "monkey123", "dragon123", "football1", "baseball1", "sunshine1", "princess1",
  "master123", "login123", "changeme", "changeme1", "trustno1", "11111111", "00000000", "88888888", "987654321",
  "йцукенгшщ", "qwertyuiop1", "wageflow1", "wageflow123",
]);

/** The whole password is one character, or a plain run like 12345678 / abcdefgh / 87654321. */
function isTrivial(s: string): boolean {
  if (new Set(s).size === 1) return true;
  const codes = [...s].map((c) => c.codePointAt(0)!);
  const step = codes[1] - codes[0];
  return Math.abs(step) === 1 && codes.every((c, i) => i === 0 || c - codes[i - 1] === step);
}

export function isCommonPassword(s: string): boolean {
  return COMMON_PASSWORDS.has(s.toLowerCase()) || isTrivial(s);
}

/** True when the password contains the part of the email before the "@" (when that part is long enough to matter). */
export function containsEmailName(password: string, email: string): boolean {
  const local = email.split("@")[0]?.toLowerCase() ?? "";
  return local.length >= 4 && password.toLowerCase().includes(local);
}

/** A new password (sign-up, password change): 8+ characters with letters and digits, nothing silly. */
export const passwordSchema = z
  .string()
  .min(8, { error: "passwordShort" })
  .refine((s) => byteLength(s) <= 72, { error: "passwordLong" })
  .refine((s) => !/[\u0000-\u001f\u007f]/.test(s), { error: "passwordChars" })
  .refine((s) => s.trim() !== "", { error: "passwordWeak" })
  .refine((s) => /\p{L}/u.test(s) && /\p{Nd}/u.test(s), { error: "passwordWeak" })
  .refine((s) => !isCommonPassword(s), { error: "passwordCommon" });

/** The password typed at sign-in: only checked for being sane, never for strength (old accounts must still get in). */
const loginPassword = z
  .string()
  .min(1, { error: "required" })
  .refine((s) => byteLength(s) <= 72, { error: "passwordLong" })
  .refine((s) => !/[\u0000-\u001f\u007f]/.test(s), { error: "passwordChars" });

export const loginSchema = z.object({
  email,
  password: loginPassword,
});

export const registerSchema = z
  .object({
    name: z.string().trim().max(60, { error: "nameLong" }),
    email,
    password: passwordSchema,
  })
  .superRefine((v, ctx) => {
    if (containsEmailName(v.password, v.email)) {
      ctx.addIssue({ code: "custom", path: ["password"], message: "passwordEmail" });
    }
  });

export type LoginValues = z.infer<typeof loginSchema>;
export type RegisterValues = z.infer<typeof registerSchema>;

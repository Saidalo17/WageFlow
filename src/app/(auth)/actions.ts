"use server";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { getLocale } from "next-intl/server";
import { AuthError } from "next-auth";
import { signIn, signOut } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { isUniqueViolation } from "@/lib/db/errors";
import { categories, users } from "@/lib/db/schema";
import { DEFAULT_CATEGORIES, DEFAULT_CURRENCY_BY_LOCALE } from "@/lib/default-categories";
import { sendMail } from "@/lib/mail";
import { attemptKeys, clearFailures, isRateLimited, recordFailure } from "@/lib/rate-limit";
import { buildResetEmail } from "@/lib/reset-email";
import { consumeResetToken, createResetToken } from "@/lib/services/password-reset";
import { forgotSchema, loginSchema, registerSchema, resetSchema } from "@/lib/validators/auth";
import { isLocale, LOCALE_COOKIE } from "@/i18n/config";

export type AuthResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

function flatten(issues: { path: PropertyKey[]; message: string }[]) {
  const fieldErrors: Record<string, string> = {};
  for (const issue of issues) {
    const field = String(issue.path[0] ?? "form");
    fieldErrors[field] ??= issue.message;
  }
  return fieldErrors;
}

async function doSignIn(email: string, password: string): Promise<AuthResult> {
  try {
    const result = await signIn("credentials", { email, password, redirect: false });
    // With redirect:false some versions return the callback URL instead of throwing.
    if (typeof result === "string" && result.includes("error=")) {
      return {
        ok: false,
        error: result.includes("too_many_attempts") ? "tooManyAttempts" : "invalidCredentials",
      };
    }
    return { ok: true };
  } catch (e) {
    if (e instanceof AuthError) {
      const code = (e as AuthError & { code?: string }).code;
      return {
        ok: false,
        error: code === "too_many_attempts" ? "tooManyAttempts" : "invalidCredentials",
      };
    }
    throw e;
  }
}

export async function registerUser(input: unknown): Promise<AuthResult> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "invalid", fieldErrors: flatten(parsed.error.issues) };
  }
  const { name, password } = parsed.data;
  const email = parsed.data.email.toLowerCase();

  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (existing) return { ok: false, error: "emailTaken", fieldErrors: { email: "emailTaken" } };

  const locale = await getLocale();
  const userId = crypto.randomUUID();
  const passwordHash = await bcrypt.hash(password, 12);

  try {
    // One atomic batch: the user and the standard categories are created together or not at all.
    await db.batch([
      db.insert(users).values({
        id: userId,
        email,
        passwordHash,
        name: name || null,
        locale,
        currency: DEFAULT_CURRENCY_BY_LOCALE[locale] ?? "USD",
      }),
      db.insert(categories).values(
        DEFAULT_CATEGORIES.map((c) => ({ ...c, userId })),
      ),
    ]);
  } catch (e) {
    if (isUniqueViolation(e)) {
      return { ok: false, error: "emailTaken", fieldErrors: { email: "emailTaken" } };
    }
    console.error("registerUser failed", e instanceof Error ? e.message : e);
    return { ok: false, error: "generic" };
  }

  return doSignIn(email, password);
}

export async function loginUser(input: unknown): Promise<AuthResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "invalid", fieldErrors: flatten(parsed.error.issues) };
  }
  const email = parsed.data.email.toLowerCase();
  const result = await doSignIn(email, parsed.data.password);

  if (result.ok) {
    // Continue in the language the user chose last time.
    const [user] = await db.select({ locale: users.locale }).from(users).where(eq(users.email, email));
    if (user && isLocale(user.locale)) {
      (await cookies()).set(LOCALE_COOKIE, user.locale, {
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
        sameSite: "lax",
      });
    }
  }
  return result;
}

export async function logoutUser() {
  await signOut({ redirectTo: "/login" });
}

/** Where the reset link points. Taken from AUTH_URL, never from the request, so nobody can make us email a link to another site. */
function siteUrl(requestHeaders: Headers): string {
  const configured = process.env.AUTH_URL?.replace(/\/+$/, "");
  if (configured) return configured;
  if (process.env.NODE_ENV !== "production") {
    return `${requestHeaders.get("x-forwarded-proto") ?? "http"}://${requestHeaders.get("host")}`;
  }
  throw new Error("AUTH_URL is not set");
}

/**
 * "Forgot password": emails a one-hour, one-time link to reset the password.
 * The answer is the same whether or not the email has an account, so this cannot be used to find out who is registered.
 * The password itself is never sent (it is not even stored, only a hash).
 */
export async function requestPasswordReset(input: unknown): Promise<AuthResult> {
  const parsed = forgotSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "invalid", fieldErrors: flatten(parsed.error.issues) };
  }
  const email = parsed.data.email.toLowerCase();
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0].trim() || null;

  // At most 5 requests per 15 minutes per address and per IP (every request counts, not only failures).
  const keys = attemptKeys(email, ip).map((k) => `reset:${k}`);
  if (await isRateLimited(keys)) return { ok: false, error: "tooManyAttempts" };
  await recordFailure(keys);

  const [user] = await db
    .select({ id: users.id, name: users.name, locale: users.locale })
    .from(users)
    .where(eq(users.email, email));
  if (user) {
    try {
      const token = await createResetToken(user.id);
      const link = `${siteUrl(h)}/reset-password?token=${encodeURIComponent(token)}`;
      await sendMail(await buildResetEmail({ to: email, name: user.name, locale: user.locale, link }));
    } catch (e) {
      // Not shown to the visitor (that would reveal that the account exists), but visible in the server log.
      console.error("password reset email failed:", e instanceof Error ? e.message : e);
    }
  }
  return { ok: true };
}

/** Sets a new password from the emailed link. The link stops working right after. */
export async function resetPassword(input: unknown): Promise<AuthResult> {
  const parsed = resetSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "invalid", fieldErrors: flatten(parsed.error.issues) };
  }
  const user = await consumeResetToken(parsed.data.token, await bcrypt.hash(parsed.data.password, 12));
  if (!user) return { ok: false, error: "resetInvalid" };
  // A person who just proved they own the mailbox should not stay locked out by earlier wrong guesses.
  await clearFailures([`email:${user.email}`, `pwd:${user.id}`]);
  return { ok: true };
}

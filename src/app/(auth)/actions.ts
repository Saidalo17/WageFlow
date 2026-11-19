"use server";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { getLocale } from "next-intl/server";
import { AuthError } from "next-auth";
import { signIn, signOut } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { categories, users } from "@/lib/db/schema";
import { DEFAULT_CATEGORIES, DEFAULT_CURRENCY_BY_LOCALE } from "@/lib/default-categories";
import { loginSchema, registerSchema } from "@/lib/validators/auth";
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
    if (e instanceof Error && /UNIQUE/i.test(e.message)) {
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

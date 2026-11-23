"use server";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { isRateLimited, recordFailure, type Limit } from "@/lib/rate-limit";

const HOUR_MS = 60 * 60 * 1000;
import { getLocale } from "next-intl/server";
import { AuthError } from "next-auth";
import { signIn, signOut } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { isUniqueViolation } from "@/lib/db/errors";
import { categories, users } from "@/lib/db/schema";
import { DEFAULT_CATEGORIES, DEFAULT_CURRENCY_BY_LOCALE } from "@/lib/default-categories";
import { checkEmailDomain, deliverabilityCheckEnabled } from "@/lib/email-check";
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

function errorKey(code: string | undefined | null) {
  if (code === "too_many_attempts") return "tooManyAttempts";
  if (code === "totp_required") return "totpRequired";
  if (code === "invalid_code") return "invalidCode";
  return "invalidCredentials";
}

async function doSignIn(email: string, password: string, code = ""): Promise<AuthResult> {
  try {
    const result = await signIn("credentials", { email, password, code, redirect: false });
    // With redirect:false some versions return the callback URL instead of throwing.
    if (typeof result === "string" && result.includes("error=")) {
      const found = /code=([a-z_]+)/.exec(result)?.[1] ?? (result.includes("too_many_attempts") ? "too_many_attempts" : null);
      return { ok: false, error: errorKey(found) };
    }
    return { ok: true };
  } catch (e) {
    if (e instanceof AuthError) {
      return { ok: false, error: errorKey((e as AuthError & { code?: string }).code) };
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

  // At most 5 sign-up attempts per address in 15 minutes (each costs a DNS lookup and a slow hash).
  const ip = (await headers()).get("x-forwarded-for")?.split(",").at(-1)?.trim();
  if (ip) {
    const key = [`register:${ip}`];
    if (await isRateLimited(key)) return { ok: false, error: "tooManyAttempts" };
    await recordFailure(key);
  }
  // "Is this email registered?" is answered by the form, so asking it over and over is how a list of customers
  // is collected. Answers that reveal an existing account are limited much harder: 3 per hour per address,
  // and 60 per hour for everybody together.
  const probes: Limit[] = [{ key: "regtaken:all", max: 60, windowMs: HOUR_MS }, ...(ip ? [{ key: `regtaken:${ip}`, max: 3, windowMs: HOUR_MS }] : [])];
  if (await isRateLimited(probes)) return { ok: false, error: "tooManyAttempts" };

  // Is this address one that can receive mail at all? (production; see lib/email-check.ts)
  if (deliverabilityCheckEnabled()) {
    const domain = await checkEmailDomain(email);
    if (domain === "reserved") return { ok: false, error: "invalid", fieldErrors: { email: "email" } };
    if (domain === "no-mail") return { ok: false, error: "invalid", fieldErrors: { email: "emailDomain" } };
  }

  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (existing) {
    // Take as long as a real sign-up would, so the response time does not give the answer away either
    await bcrypt.hash(password, 12);
    await recordFailure(probes);
    return { ok: false, error: "emailTaken", fieldErrors: { email: "emailTaken" } };
  }

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
  const code = typeof (input as { code?: unknown })?.code === "string" ? (input as { code: string }).code : "";
  const result = await doSignIn(email, parsed.data.password, code);

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

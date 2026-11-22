"use server";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { signOut } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { budgets, categories, loginAttempts, transactions, users } from "@/lib/db/schema";
import { RatesUnavailableError } from "@/lib/fx";
import { switchUserCurrency } from "@/lib/services/currency-switch";
import { clearFailures, isRateLimited, recordFailure } from "@/lib/rate-limit";
import { getCurrentUser } from "@/lib/session";
import { detectImageType } from "@/lib/avatar";
import { MAX_AVATAR_BYTES } from "@/lib/profile-meta";
import { removeAvatar, setAvatar, updateDecoration } from "@/lib/services/profile";
import {
  changePasswordSchema,
  countrySchema,
  decorationSchema,
  deleteAccountSchema,
  profileSchema,
} from "@/lib/validators/settings";
import { LOCALE_COOKIE } from "@/i18n/config";

export type ActionResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

function fieldErrorsOf(issues: { path: PropertyKey[]; message: string }[]) {
  const out: Record<string, string> = {};
  for (const i of issues) out[String(i.path[0] ?? "form")] ??= i.message;
  return out;
}

export async function updateProfile(input: unknown): Promise<ActionResult> {
  const user = await getCurrentUser();
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "invalid", fieldErrors: fieldErrorsOf(parsed.error.issues) };
  }
  const { name, currency, locale, monthStartDay } = parsed.data;

  try {
    if (currency !== user.currency) {
      // Every amount is recalculated at today's rate (all or nothing).
      await switchUserCurrency(user.id, user.currency, currency, { name: name || null, locale, monthStartDay });
    } else {
      await db
        .update(users)
        .set({ name: name || null, locale, monthStartDay })
        .where(eq(users.id, user.id));
    }
  } catch (e) {
    if (e instanceof RatesUnavailableError) return { ok: false, error: "ratesUnavailable" };
    console.error("updateProfile failed", e instanceof Error ? e.message : e);
    return { ok: false, error: "generic" };
  }

  // The interface language follows the profile right away.
  (await cookies()).set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Checks the password of the signed-in user. Wrong guesses are counted
 * (5 per 15 minutes), so this cannot be used to guess a password.
 */
async function verifyPassword(userId: string, password: string): Promise<"ok" | "wrong" | "limited"> {
  const keys = [`pwd:${userId}`];
  if (await isRateLimited(keys)) return "limited";
  const [row] = await db.select({ hash: users.passwordHash }).from(users).where(eq(users.id, userId));
  const ok = row ? await bcrypt.compare(password, row.hash) : false;
  if (!ok) {
    await recordFailure(keys);
    return "wrong";
  }
  await clearFailures(keys);
  return "ok";
}

export async function changePassword(input: unknown): Promise<ActionResult> {
  const user = await getCurrentUser();
  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "invalid", fieldErrors: fieldErrorsOf(parsed.error.issues) };
  }
  const { current, next } = parsed.data;

  const check = await verifyPassword(user.id, current);
  if (check === "limited") return { ok: false, error: "tooManyAttempts" };
  if (check === "wrong") {
    return { ok: false, error: "invalid", fieldErrors: { current: "wrongPassword" } };
  }
  if (current === next) {
    return { ok: false, error: "invalid", fieldErrors: { next: "samePassword" } };
  }

  await db
    .update(users)
    .set({ passwordHash: await bcrypt.hash(next, 12) })
    .where(eq(users.id, user.id));
  return { ok: true };
}

/** Permanently deletes the account and everything in it, then signs the user out. */
export async function deleteAccount(input: unknown): Promise<ActionResult> {
  const user = await getCurrentUser();
  const parsed = deleteAccountSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "invalid", fieldErrors: fieldErrorsOf(parsed.error.issues) };
  }

  const check = await verifyPassword(user.id, parsed.data.password);
  if (check === "limited") return { ok: false, error: "tooManyAttempts" };
  if (check === "wrong") {
    return { ok: false, error: "invalid", fieldErrors: { password: "wrongPassword" } };
  }

  try {
    // Deleted in a safe order, all or nothing: limits, transactions, categories, attempts, then the user.
    await db.batch([
      db.delete(budgets).where(eq(budgets.userId, user.id)),
      db.delete(transactions).where(eq(transactions.userId, user.id)),
      db.delete(categories).where(eq(categories.userId, user.id)),
      db.delete(loginAttempts).where(eq(loginAttempts.key, `email:${user.email}`)),
      db.delete(loginAttempts).where(eq(loginAttempts.key, `pwd:${user.id}`)),
      db.delete(users).where(eq(users.id, user.id)),
    ]);
  } catch (e) {
    console.error("deleteAccount failed", e instanceof Error ? e.message : e);
    return { ok: false, error: "generic" };
  }

  await signOut({ redirectTo: "/login" });
  return { ok: true };
}

/** Saves the short text, emoji and accent color of the profile card. */
export async function updateProfileCard(input: unknown): Promise<ActionResult> {
  const user = await getCurrentUser();
  const parsed = decorationSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "invalid", fieldErrors: fieldErrorsOf(parsed.error.issues) };
  }
  await updateDecoration(user.id, parsed.data);
  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Saves the profile photo. The browser has already cropped it to a small square, but the server does not trust that:
 * it checks the size and what the file really is (JPEG, PNG or WebP by its first bytes; SVG and other types are refused).
 */
export async function uploadAvatar(formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  const file = formData.get("photo");
  if (!(file instanceof File)) return { ok: false, error: "photoInvalid" };
  if (file.size > MAX_AVATAR_BYTES) return { ok: false, error: "photoTooLarge" };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime = detectImageType(bytes);
  if (!mime) return { ok: false, error: "photoInvalid" };
  await setAvatar(user.id, bytes, mime);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteAvatar(): Promise<ActionResult> {
  const user = await getCurrentUser();
  await removeAvatar(user.id);
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Saves the country whose tax rules the salary calculator uses by default ("" = none). */
export async function updateCountry(input: unknown): Promise<ActionResult> {
  const user = await getCurrentUser();
  const parsed = countrySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "generic" };
  await db.update(users).set({ country: parsed.data }).where(eq(users.id, user.id));
  revalidatePath("/", "layout");
  return { ok: true };
}

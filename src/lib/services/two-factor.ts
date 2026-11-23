import { and, eq, isNull, lt, or } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import {
  decryptSecret,
  encryptSecret,
  generateBackupCodes,
  generateSecret,
  hashBackupCode,
  looksLikeBackupCode,
  verifyTotp,
} from "@/lib/totp";

/** Every function takes the user's id and puts it in the WHERE clause. */

async function load(userId: string) {
  const [row] = await db
    .select({ secret: users.totpSecret, enabled: users.totpEnabled, lastStep: users.totpLastStep, backup: users.totpBackup })
    .from(users)
    .where(eq(users.id, userId));
  return row ?? null;
}

/** Marks a TOTP step as used, but only if it is newer than the last one (two requests cannot both win). */
async function claimStep(userId: string, step: number): Promise<boolean> {
  const res = await db
    .update(users)
    .set({ totpLastStep: step })
    .where(and(eq(users.id, userId), or(isNull(users.totpLastStep), lt(users.totpLastStep, step))));
  return res.rowsAffected > 0;
}

/**
 * The second factor typed at sign-in or when disabling: the 6-digit code from the app, or one backup code.
 * A code works once.
 */
export async function checkSecondFactor(userId: string, input: string): Promise<boolean> {
  const row = await load(userId);
  if (!row?.enabled || !row.secret) return false;
  const typed = input.trim();

  if (looksLikeBackupCode(typed)) {
    const hash = hashBackupCode(typed);
    const list: string[] = JSON.parse(row.backup ?? "[]");
    if (!list.includes(hash)) return false;
    // Remove it only if the list is still the one we read: a code cannot be spent twice
    const res = await db
      .update(users)
      .set({ totpBackup: JSON.stringify(list.filter((h) => h !== hash)) })
      .where(and(eq(users.id, userId), eq(users.totpBackup, row.backup ?? "[]")));
    return res.rowsAffected > 0;
  }

  const step = verifyTotp(decryptSecret(row.secret), typed, Date.now(), row.lastStep);
  return step !== null && (await claimStep(userId, step));
}

export async function isTwoFactorEnabled(userId: string): Promise<boolean> {
  return (await load(userId))?.enabled ?? false;
}

/** Starts (or restarts) setup: a fresh secret is kept, not active until the first code is confirmed. */
export async function beginSetup(userId: string): Promise<{ secret: string } | null> {
  const row = await load(userId);
  if (!row || row.enabled) return null;
  const secret = generateSecret();
  await db.update(users).set({ totpSecret: encryptSecret(secret), totpLastStep: null }).where(eq(users.id, userId));
  return { secret };
}

/** Turns two-factor on when the code from the app is right. Returns the backup codes (shown once), or null. */
export async function confirmSetup(userId: string, code: string): Promise<string[] | null> {
  const row = await load(userId);
  if (!row || row.enabled || !row.secret) return null;
  const step = verifyTotp(decryptSecret(row.secret), code);
  if (step === null) return null;
  const codes = generateBackupCodes();
  await db
    .update(users)
    .set({ totpEnabled: true, totpLastStep: step, totpBackup: JSON.stringify(codes.map(hashBackupCode)) })
    .where(eq(users.id, userId));
  return codes;
}

export async function disableTwoFactor(userId: string) {
  await db.update(users).set({ totpEnabled: false, totpSecret: null, totpLastStep: null, totpBackup: null }).where(eq(users.id, userId));
}

/** The pending secret during setup, to draw the QR code again after a page reload. */
export async function pendingSecret(userId: string): Promise<string | null> {
  const row = await load(userId);
  return row && !row.enabled && row.secret ? decryptSecret(row.secret) : null;
}

export async function backupCodesLeft(userId: string): Promise<number> {
  const row = await load(userId);
  return row?.enabled ? (JSON.parse(row.backup ?? "[]") as string[]).length : 0;
}

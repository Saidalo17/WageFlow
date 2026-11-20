import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, lt } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { passwordResets, users } from "@/lib/db/schema";

/** A reset link works once and for one hour. */
export const RESET_TTL_MS = 60 * 60 * 1000;

const hash = (token: string) => createHash("sha256").update(token).digest("hex");

/**
 * Creates a reset link token for the user and returns it. Only its hash is stored,
 * so a leaked database cannot be used to reset anyone's password.
 * Older unused links of the same user stop working.
 */
export async function createResetToken(userId: string, now = Date.now()): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await db.batch([
    db.delete(passwordResets).where(eq(passwordResets.userId, userId)),
    db.delete(passwordResets).where(lt(passwordResets.expiresAt, now)),
    db.insert(passwordResets).values({ userId, tokenHash: hash(token), expiresAt: now + RESET_TTL_MS }),
  ]);
  return token;
}

/** True when the token exists and has not expired (used to show the form or an "expired" message). */
export async function isResetTokenValid(token: string, now = Date.now()): Promise<boolean> {
  if (!token || token.length > 200) return false;
  const [row] = await db
    .select({ id: passwordResets.id })
    .from(passwordResets)
    .where(and(eq(passwordResets.tokenHash, hash(token)), gt(passwordResets.expiresAt, now)));
  return !!row;
}

/**
 * Sets the new password hash and burns the token (and any other links of this user), all or nothing.
 * Returns the user's id and email, or null when the token is unknown, used or expired.
 */
export async function consumeResetToken(
  token: string,
  passwordHash: string,
  now = Date.now(),
): Promise<{ id: string; email: string } | null> {
  if (!token || token.length > 200) return null;
  const [row] = await db
    .select({ userId: passwordResets.userId, email: users.email })
    .from(passwordResets)
    .innerJoin(users, eq(users.id, passwordResets.userId))
    .where(and(eq(passwordResets.tokenHash, hash(token)), gt(passwordResets.expiresAt, now)));
  if (!row) return null;
  await db.batch([
    db.update(users).set({ passwordHash }).where(eq(users.id, row.userId)),
    db.delete(passwordResets).where(eq(passwordResets.userId, row.userId)),
  ]);
  return { id: row.userId, email: row.email };
}

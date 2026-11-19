import { and, count, eq, gt, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { loginAttempts } from "@/lib/db/schema";

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

/** True when any of the keys already has 5 failed attempts in the last 15 minutes. */
export async function isRateLimited(keys: string[]): Promise<boolean> {
  const since = Date.now() - WINDOW_MS;
  for (const key of keys) {
    const [row] = await db
      .select({ n: count() })
      .from(loginAttempts)
      .where(and(eq(loginAttempts.key, key), gt(loginAttempts.createdAt, since)));
    if ((row?.n ?? 0) >= MAX_ATTEMPTS) return true;
  }
  return false;
}

export async function recordFailure(keys: string[]) {
  if (keys.length === 0) return;
  await db.insert(loginAttempts).values(keys.map((key) => ({ key })));
}

export async function clearFailures(keys: string[]) {
  if (keys.length === 0) return;
  await db.delete(loginAttempts).where(inArray(loginAttempts.key, keys));
}

export function attemptKeys(email: string, ip: string | null): string[] {
  const keys = [`email:${email}`];
  if (ip) keys.push(`ip:${ip}`);
  return keys;
}

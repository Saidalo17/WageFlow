import { and, count, eq, gt, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { loginAttempts } from "@/lib/db/schema";

const DEFAULT_MAX = 5;
const DEFAULT_WINDOW_MS = 15 * 60 * 1000;

/** One counter: a key, how many failures it tolerates and over which time. */
export type Limit = {
  key: string;
  /** Failures allowed in the window (default 5). */
  max?: number;
  /** Window in milliseconds (default 15 minutes). */
  windowMs?: number;
  /** Forget the counter after a successful sign-in (only for counters that belong to one person at one address). */
  clearOnSuccess?: boolean;
};

const keyOf = (l: string | Limit) => (typeof l === "string" ? l : l.key);

/** True when any of the counters is already full. */
export async function isRateLimited(limits: (string | Limit)[]): Promise<boolean> {
  for (const l of limits) {
    const { key, max = DEFAULT_MAX, windowMs = DEFAULT_WINDOW_MS } = typeof l === "string" ? { key: l } : l;
    const [row] = await db
      .select({ n: count() })
      .from(loginAttempts)
      .where(and(eq(loginAttempts.key, key), gt(loginAttempts.createdAt, Date.now() - windowMs)));
    if ((row?.n ?? 0) >= max) return true;
  }
  return false;
}

export async function recordFailure(limits: (string | Limit)[]) {
  if (limits.length === 0) return;
  await db.insert(loginAttempts).values(limits.map((l) => ({ key: keyOf(l) })));
}

export async function clearFailures(limits: (string | Limit)[]) {
  const keys = limits.filter((l) => typeof l === "string" || l.clearOnSuccess).map(keyOf);
  if (keys.length === 0) return;
  await db.delete(loginAttempts).where(inArray(loginAttempts.key, keys));
}

/**
 * Counters for one sign-in attempt.
 * - the pair (this email from this address): 5 failures. A stranger guessing at somebody's account only
 *   locks out his own address, never the owner.
 * - the email from anywhere: 30 failures, which stops a botnet that spreads guesses over many addresses.
 * - the address across all emails: 20 failures, which stops one machine trying many accounts.
 * Without a known address the email alone is held to 5, the strict old rule.
 */
export function attemptKeys(email: string, ip: string | null): Limit[] {
  if (!ip) return [{ key: `email:${email}`, clearOnSuccess: true }];
  return [
    { key: `pair:${email}|${ip}`, max: 5, clearOnSuccess: true },
    { key: `email:${email}`, max: 30 },
    { key: `ip:${ip}`, max: 20 },
  ];
}

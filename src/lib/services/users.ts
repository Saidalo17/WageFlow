import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";

/** After this many days without a visit the overview says "Glad you're back". */
export const AWAY_DAYS = 7;
const HOUR_MS = 60 * 60 * 1000;

/**
 * Remembers that the user is here now. Returns true when they were away for a long time.
 * The time is written at most once per hour, so ordinary page loads cost no extra writes.
 */
export async function touchLastSeen(
  userId: string,
  lastSeenAt: number | null,
  now = Date.now(),
): Promise<boolean> {
  const away = lastSeenAt !== null && now - lastSeenAt > AWAY_DAYS * 24 * HOUR_MS;
  if (lastSeenAt === null || now - lastSeenAt > HOUR_MS) {
    await db.update(users).set({ lastSeenAt: now }).where(eq(users.id, userId));
  }
  return away;
}

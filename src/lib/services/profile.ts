import { and, eq, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import type { AvatarMime } from "@/lib/avatar";

/** Every function takes the signed-in user's id, so nobody can read or change another user's profile. */

export async function setAvatar(userId: string, bytes: Uint8Array, mime: AvatarMime, now = Date.now()) {
  await db
    .update(users)
    .set({ avatar: Buffer.from(bytes).toString("base64"), avatarMime: mime, avatarUpdatedAt: now })
    .where(eq(users.id, userId));
}

export async function removeAvatar(userId: string) {
  await db.update(users).set({ avatar: null, avatarMime: null, avatarUpdatedAt: null }).where(eq(users.id, userId));
}

export async function getAvatar(userId: string): Promise<{ bytes: Buffer; mime: string } | null> {
  const [row] = await db
    .select({ avatar: users.avatar, mime: users.avatarMime })
    .from(users)
    .where(and(eq(users.id, userId), isNotNull(users.avatar)));
  if (!row?.avatar || !row.mime) return null;
  return { bytes: Buffer.from(row.avatar, "base64"), mime: row.mime };
}

export async function updateDecoration(
  userId: string,
  values: { bio: string | null; emoji: string | null; accent: string | null },
) {
  await db.update(users).set(values).where(eq(users.id, userId));
}

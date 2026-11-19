import { db } from "@/lib/db/client";
import { categories, users } from "@/lib/db/schema";
import { DEFAULT_CATEGORIES } from "@/lib/default-categories";

let counter = 0;

/** Creates a user with the standard categories, like the sign-up form does. */
export async function createTestUser(prefix = "user") {
  const id = crypto.randomUUID();
  counter += 1;
  await db.insert(users).values({
    id,
    email: `${prefix}-${counter}-${Date.now()}@example.test`,
    passwordHash: "not-a-real-hash",
    currency: "USD",
  });
  await db.insert(categories).values(DEFAULT_CATEGORIES.map((c) => ({ ...c, userId: id })));
  const rows = await db.select().from(categories);
  const byKey: Record<string, string> = {};
  for (const r of rows) if (r.userId === id && r.systemKey) byKey[r.systemKey] = r.id;
  return { id, cat: byKey };
}

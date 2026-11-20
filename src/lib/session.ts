import { cache } from "react";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";

/** Returns the signed-in user's id, or sends the visitor to /login. Use in every server function that touches data. */
export async function requireUser(): Promise<{ id: string }> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return { id: session.user.id };
}

/** Full profile of the signed-in user (cached per request). */
export const getCurrentUser = cache(async () => {
  const { id } = await requireUser();
  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      currency: users.currency,
      locale: users.locale,
      monthStartDay: users.monthStartDay,
      lastSeenAt: users.lastSeenAt,
    })
    .from(users)
    .where(eq(users.id, id));
  // The account was deleted but the cookie is still valid: clear it, then go to /login.
  if (!user) redirect("/api/session-expired");
  return user;
});

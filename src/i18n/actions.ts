"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { isLocale, LOCALE_COOKIE } from "./config";

/** Saves the chosen language in a cookie, and in the profile when signed in. */
export async function setLocale(locale: string) {
  if (!isLocale(locale)) return { ok: false as const };

  (await cookies()).set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });

  const userId = (await auth())?.user?.id;
  if (userId) {
    await db.update(users).set({ locale }).where(eq(users.id, userId));
  }

  revalidatePath("/", "layout");
  return { ok: true as const };
}

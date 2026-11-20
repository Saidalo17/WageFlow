"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { isValidCurrency } from "@/lib/currencies";
import { DISPLAY_CURRENCY_COOKIE } from "@/lib/display-currency";
import { getCurrentUser } from "@/lib/session";

/** Chooses the currency amounts are shown in (null or the main currency = back to normal). Nothing in the database changes. */
export async function setDisplayCurrency(code: unknown): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  const jar = await cookies();
  if (code === null || code === user.currency) {
    jar.delete(DISPLAY_CURRENCY_COOKIE);
  } else if (typeof code === "string" && isValidCurrency(code)) {
    jar.set(DISPLAY_CURRENCY_COOKIE, code, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  } else {
    return { ok: false };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

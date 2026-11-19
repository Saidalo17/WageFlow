import { signOut } from "@/lib/auth";

/**
 * The session cookie is valid but its user no longer exists (e.g. the account was deleted).
 * Clearing the cookie here, in a route handler, avoids a /login <-> / redirect loop.
 */
export async function GET() {
  await signOut({ redirectTo: "/login" });
}

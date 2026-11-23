import NextAuth, { CredentialsSignin, type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { loginSchema } from "@/lib/validators/auth";
import { attemptKeys, clearFailures, isRateLimited, recordFailure } from "@/lib/rate-limit";
import { checkSecondFactor } from "@/lib/services/two-factor";

declare module "next-auth" {
  interface Session {
    user: { id: string } & DefaultSession["user"];
  }
}

export class TooManyAttempts extends CredentialsSignin {
  code = "too_many_attempts";
}

/** The password was right, and the account asks for the code from the authenticator app as well. */
export class TotpRequired extends CredentialsSignin {
  code = "totp_required";
}

export class InvalidCode extends CredentialsSignin {
  code = "invalid_code";
}

// Compared when the email is unknown, so response time does not reveal which emails exist.
const dummyHash = bcrypt.hash("not-a-real-password", 12);

function clientIp(request: Request): string | null {
  // The last entry is the one our own proxy appended; earlier ones can be written by the client.
  return request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() || null;
}

// A page asks for the session several times; the version is looked up once per few seconds per user.
const versionCache = new Map<string, { v: number | null; at: number }>();
const VERSION_TTL_MS = 3_000;

async function currentSessionVersion(userId: string, fresh = false): Promise<number | null> {
  const hit = versionCache.get(userId);
  if (!fresh && hit && Date.now() - hit.at < VERSION_TTL_MS) return hit.v;
  const [row] = await db.select({ v: users.sessionVersion }).from(users).where(eq(users.id, userId));
  const v = row ? row.v : null;
  if (versionCache.size > 5000) versionCache.clear();
  versionCache.set(userId, { v, at: Date.now() });
  return v;
}

export const { handlers, auth, signIn, signOut, unstable_update } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt", maxAge: 60 * 60 * 12 },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: { email: {}, password: {}, code: {} },
      async authorize(credentials, request) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;
        const email = parsed.data.email.toLowerCase();
        const { password } = parsed.data;

        const keys = attemptKeys(email, clientIp(request));
        if (await isRateLimited(keys)) throw new TooManyAttempts();

        const [user] = await db.select().from(users).where(eq(users.email, email));
        const ok = await bcrypt.compare(password, user?.passwordHash ?? (await dummyHash));
        if (!user || !ok) {
          await recordFailure(keys);
          return null;
        }
        if (user.totpEnabled) {
          const code = typeof credentials?.code === "string" ? credentials.code.trim().slice(0, 32) : "";
          if (!code) throw new TotpRequired(); // not a failure: the form now asks for the code
          // A wrong code counts like a wrong password, so the code cannot be guessed either
          if (!(await checkSecondFactor(user.id, code))) {
            await recordFailure(keys);
            throw new InvalidCode();
          }
        }
        await clearFailures(keys);
        return { id: user.id, email: user.email, name: user.name, sessionVersion: user.sessionVersion };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user?.id) {
        token.uid = user.id;
        token.sv = (user as { sessionVersion?: number }).sessionVersion ?? 0;
      } else if (trigger === "update" && token.uid) {
        // After a password change the current device takes the new version, every other one is signed out
        const current = await currentSessionVersion(token.uid as string, true);
        if (current !== null) token.sv = current;
      }
      return token;
    },
    async session({ session, token }) {
      const uid = token.uid as string | undefined;
      if (!uid) return session;
      // A cookie issued before the last password change (or for a deleted account) is no longer a session
      const current = await currentSessionVersion(uid);
      if (current === null || current !== ((token.sv as number | undefined) ?? 0)) {
        return { expires: session.expires } as typeof session;
      }
      session.user.id = uid;
      return session;
    },
  },
});

import NextAuth, { CredentialsSignin, type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { loginSchema } from "@/lib/validators/auth";
import { attemptKeys, clearFailures, isRateLimited, recordFailure } from "@/lib/rate-limit";

declare module "next-auth" {
  interface Session {
    user: { id: string } & DefaultSession["user"];
  }
}

export class TooManyAttempts extends CredentialsSignin {
  code = "too_many_attempts";
}

// Compared when the email is unknown, so response time does not reveal which emails exist.
const dummyHash = bcrypt.hash("not-a-real-password", 12);

function clientIp(request: Request): string | null {
  // The last entry is the one our own proxy appended; earlier ones can be written by the client.
  return request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() || null;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 30 },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
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
        await clearFailures(keys);
        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token.uid = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.uid) session.user.id = token.uid as string;
      return session;
    },
  },
});

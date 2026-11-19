import { config } from "dotenv";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { eq } from "drizzle-orm";
import * as schema from "../src/lib/db/schema";

config({ path: ".env.local" });

async function main() {
  const url = process.env.TURSO_DATABASE_URL;
  if (!url) throw new Error("TURSO_DATABASE_URL is not set");
  const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
  const db = drizzle(client, { schema });

  const email = `check-${Date.now()}@example.test`;
  const [user] = await db
    .insert(schema.users)
    .values({ email, passwordHash: "x" })
    .returning();
  const [found] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, user.id));
  if (found?.email !== email) throw new Error("Read-back failed");
  await db.delete(schema.users).where(eq(schema.users.id, user.id));
  console.log("OK: insert / read / delete works. Defaults:", {
    currency: found.currency,
    locale: found.locale,
  });
  client.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

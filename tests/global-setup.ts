import fs from "node:fs";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

const DB_FILE = ".test/integration.db";

/** Creates a fresh local database with all migrations applied before the tests run. */
export default async function setup() {
  // Safety: never run against a real (remote) database.
  if (!process.env.TURSO_DATABASE_URL?.startsWith("file:")) {
    throw new Error("Tests must use a local file database, got: " + process.env.TURSO_DATABASE_URL);
  }
  fs.mkdirSync(".test", { recursive: true });
  for (const suffix of ["", "-journal", "-wal", "-shm"]) fs.rmSync(DB_FILE + suffix, { force: true });

  const client = createClient({ url: `file:${DB_FILE}` });
  await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
  client.close();
}

// Creates a fresh local database for the end-to-end run, before the app server starts.
import fs from "node:fs";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

const DB_FILE = ".test/e2e.db";
fs.mkdirSync(".test", { recursive: true });
for (const suffix of ["", "-journal", "-wal", "-shm"]) fs.rmSync(DB_FILE + suffix, { force: true });
const client = createClient({ url: `file:${DB_FILE}` });
await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
client.close();
console.log("e2e database ready:", DB_FILE);

import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Tests never touch the real Turso database: they use a throw-away local SQLite file.
// Set here too (not only in test.env) so the global setup, which runs in the main process, sees it.
process.env.TURSO_DATABASE_URL = "file:.test/integration.db";
process.env.TURSO_AUTH_TOKEN = "";
process.env.AUTH_SECRET = "test-secret-not-used";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    globalSetup: ["tests/global-setup.ts"],
    env: {
      TURSO_DATABASE_URL: "file:.test/integration.db",
      TURSO_AUTH_TOKEN: "",
      AUTH_SECRET: "test-secret-not-used",
    },
    // The integration tests share one database file, so test files run one after another.
    fileParallelism: false,
    testTimeout: 20_000,
  },
});

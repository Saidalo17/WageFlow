import { defineConfig } from "@playwright/test";

const PORT = 3100;

/**
 * End-to-end tests run the real, built app in Chrome against a throw-away local database
 * (.test/e2e.db). They never touch the real Turso database.
 * Run: npm run test:e2e   (builds the app first)
 */
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  workers: 1,
  fullyParallel: false,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    // Uses the Chrome that is already installed, so no browser has to be downloaded.
    channel: "chrome",
    locale: "en-US",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    // A fresh database first, then the built app (started with the local database from `env` below).
    command: `node tests/e2e/prepare-db.mjs && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    timeout: 120_000,
    reuseExistingServer: false,
    env: {
      TURSO_DATABASE_URL: "file:.test/e2e.db",
      TURSO_AUTH_TOKEN: "",
      AUTH_SECRET: "e2e-secret-not-used-in-production",
      // Fixed exchange rates, so the tests do not depend on the internet.
      // Emails are written to a file instead of being sent, and links point at the test server.
      MAIL_OUTBOX_FILE: ".test/outbox.jsonl",
      AUTH_URL: `http://localhost:${PORT}`,
      FX_FIXED_RATES: JSON.stringify({ USD: 1, EUR: 0.5, JPY: 150 }),
    },
  },
});

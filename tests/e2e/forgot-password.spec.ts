import fs from "node:fs";
import { expect, test } from "@playwright/test";
import { PASSWORD, ready, register, uniqueEmail } from "./helpers";

const OUTBOX = ".test/outbox.jsonl";

/** The latest email sent to an address (the app writes emails to a file during tests). */
function lastMailTo(email: string) {
  if (!fs.existsSync(OUTBOX)) return null;
  const mails = fs
    .readFileSync(OUTBOX, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l) as { to: string; subject: string; text: string; html: string })
    .filter((m) => m.to === email);
  return mails.at(-1) ?? null;
}

test("a user who forgot the password gets a link by email and can sign in with a new password", async ({ page, browser }) => {
  const email = uniqueEmail("forgot");
  // The account is made in a separate browser session, so the page below starts signed out.
  const setup = await browser.newContext();
  await register(await setup.newPage(), email, "Fay");
  await setup.close();

  await page.goto("/login");
  await ready(page);
  await page.getByRole("link", { name: "Forgot password?" }).click();
  await expect(page).toHaveURL(/forgot-password/);
  await ready(page);

  // An unknown address gets the same answer and no email
  await page.locator("#email").fill("nobody-" + email);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByText("If an account with this email exists")).toBeVisible();
  expect(lastMailTo("nobody-" + email)).toBeNull();

  // The real one
  await page.goto("/forgot-password");
  await ready(page);
  await page.locator("#email").fill(email);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByText("If an account with this email exists")).toBeVisible();

  const mail = lastMailTo(email);
  expect(mail, "an email was sent").not.toBeNull();
  expect(mail!.subject).toBe("Reset your Salary password");
  expect(mail!.text).not.toContain(PASSWORD); // the password is never emailed
  const link = mail!.text.match(/https?:\/\/\S+reset-password\?token=\S+/)?.[0];
  expect(link, "the email has a reset link").toBeTruthy();

  await page.goto(link!);
  await ready(page);
  await page.locator("#password").fill("brand-new-pass-1");
  await page.locator("#confirm").fill("different-pass-1");
  await page.getByRole("button", { name: "Save password" }).click();
  await expect(page.getByText("The passwords do not match")).toBeVisible();
  await page.locator("#confirm").fill("brand-new-pass-1");
  await page.getByRole("button", { name: "Save password" }).click();
  await expect(page).toHaveURL(/\/login\?reset=1/);
  await expect(page.getByText("Password changed. Sign in with your new password.")).toBeVisible();

  // The old password no longer works, the new one does
  await ready(page);
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Incorrect email or password")).toBeVisible();
  await page.locator("#password").fill("brand-new-pass-1");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/");

  // The link cannot be used a second time
  const guest = await browser.newContext();
  const guestPage = await guest.newPage();
  await guestPage.goto(link!);
  await expect(guestPage.getByText("This link is invalid or has expired.").first()).toBeVisible();
  await expect(guestPage.getByRole("link", { name: "Request a new link" })).toBeVisible();
  await guest.close();
});

test("a made-up reset link is rejected", async ({ page }) => {
  await page.goto("/reset-password?token=not-a-real-token");
  await expect(page.getByText("This link is invalid or has expired.")).toBeVisible();
  await page.goto("/reset-password");
  await expect(page.getByRole("link", { name: "Request a new link" })).toBeVisible();
});

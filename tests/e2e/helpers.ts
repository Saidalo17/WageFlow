import { expect, type Page } from "@playwright/test";

export const PASSWORD = "E2E-pass-12345";

export function uniqueEmail(prefix = "e2e") {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.test`;
}

/** Waits until React has taken over the page, so typing is not lost to a late hydration. */
export async function ready(page: Page) {
  await page.waitForLoadState("networkidle");
}

export async function register(page: Page, email: string, name = "E2E Tester") {
  await page.goto("/register");
  await ready(page);
  await page.locator("#name").fill(name);
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL("/");
}

/** Opens the "+ Add" form from the top bar. */
export async function openAddForm(page: Page) {
  await page.getByRole("banner").getByRole("button", { name: "Add" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
}

export async function addTransaction(
  page: Page,
  opts: { type: "Expense" | "Income"; category: string; amount: string; note?: string },
) {
  await openAddForm(page);
  const dialog = page.getByRole("dialog");
  if (opts.type === "Income") await dialog.getByRole("radio", { name: /Income/ }).click();
  await dialog.locator("#tx-amount").fill(opts.amount);
  await dialog.getByRole("radio", { name: opts.category }).click();
  if (opts.note) await dialog.locator("#tx-note").fill(opts.note);
  await dialog.getByRole("button", { name: "Add", exact: true }).click();
  await expectToast(page, "Transaction added");
  await expect(dialog).toBeHidden();
}

/** A toast message. It is in the page twice (the visible one and a copy for screen readers), so look at the first. */
export async function expectToast(page: Page, text: string) {
  await expect(page.getByText(text).first()).toBeVisible();
}

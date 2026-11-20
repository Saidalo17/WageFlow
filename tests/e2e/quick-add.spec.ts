import { createClient } from "@libsql/client";
import { expect, test } from "@playwright/test";
import { expectToast, ready, register, uniqueEmail } from "./helpers";

test.describe("home page: categories, manual entry, other currencies, greeting", () => {
  test("adds a custom category with its own color, then an expense from its tile", async ({ page }) => {
    await register(page, uniqueEmail("quick"), "Quinn");
    await ready(page);

    // The standard categories are shown as tiles on the home page
    const tiles = page.getByRole("list").filter({ has: page.getByRole("button", { name: "Add a transaction to Food" }) });
    await expect(tiles.getByRole("button", { name: "Add a transaction to Transport" })).toBeVisible();

    // A new category from the home page, with a custom color and an icon
    await page.getByRole("button", { name: "New category" }).first().click();
    const dialog = page.getByRole("dialog");
    await dialog.locator("#category-name").fill("Coffee shops");
    await dialog.getByRole("radio", { name: "coffee" }).click();
    await dialog.locator('input[type="color"]').fill("#123abc");
    await dialog.getByRole("button", { name: "Create" }).click();
    await expectToast(page, "Category created");
    const tile = page.getByRole("button", { name: "Add a transaction to Coffee shops" });
    await expect(tile).toBeVisible();

    // Tap the tile: the form opens with the category already chosen
    await tile.click();
    const form = page.getByRole("dialog");
    await expect(form.getByRole("radio", { name: "Coffee shops" })).toHaveAttribute("aria-checked", "true");
    await form.locator("#tx-amount").fill("4.50");
    await form.getByRole("button", { name: "Add", exact: true }).click();
    await expectToast(page, "Transaction added");

    // The tile now shows what was spent
    await expect(page.getByRole("button", { name: "Add a transaction to Coffee shops" })).toContainText("$4.50");

    // The category keeps the color that was picked
    await page.goto("/categories");
    await ready(page);
    const badgeColor = await page
      .locator("li", { hasText: "Coffee shops" })
      .first()
      .locator("span[style*='color']")
      .first()
      .evaluate((el) => getComputedStyle(el).color);
    expect(badgeColor).toBe("rgb(18, 58, 188)");
  });

  test("an expense typed in another currency is converted at the exchange rate", async ({ page }) => {
    await register(page, uniqueEmail("fx"), "Fiona");
    await ready(page);
    await page.getByRole("button", { name: "Add a transaction to Food" }).click();
    const form = page.getByRole("dialog");
    await form.locator("#tx-amount").fill("20");
    await form.locator("#tx-currency").click();
    await page.getByPlaceholder("Search by code or name").fill("euro");
    await page.getByRole("option", { name: /EUR/ }).click();
    // The test rate is 1 USD = 0.5 EUR, so 20 EUR = 40 USD
    await expect(form.getByText("≈ $40.00")).toBeVisible();
    await form.getByRole("button", { name: "Add", exact: true }).click();
    await expectToast(page, "Transaction added");

    await page.goto("/transactions");
    await expect(page.getByText("−$40.00").first()).toBeVisible(); // converted amount
    await expect(page.getByText("€20.00")).toBeVisible(); // what was typed
  });

  test("greets by the time of day and welcomes back after a long absence", async ({ page, browser }) => {
    await register(page, uniqueEmail("hello"), "Hana");
    await ready(page);

    const heading = page.getByRole("heading", { level: 1 });
    // The clock of the browser decides: 08:00 -> morning, 14:00 -> afternoon, 20:00 -> evening, 02:00 -> night
    const cases: [string, RegExp][] = [
      ["2026-06-15T08:00:00", /^Good morning, Hana$/],
      ["2026-06-15T14:00:00", /^Good afternoon, Hana$/],
      ["2026-06-15T20:00:00", /^Good evening, Hana$/],
      ["2026-06-15T02:00:00", /^Good night, Hana$/],
    ];
    for (const [time, expected] of cases) {
      const context = await browser.newContext({ storageState: await page.context().storageState() });
      const p = await context.newPage();
      await p.clock.install({ time: new Date(time) });
      await p.goto("/");
      await expect(p.getByRole("heading", { level: 1 })).toHaveText(expected);
      await context.close();
    }
    await expect(heading).toBeVisible();
  });

  test("welcomes the user back after more than a week away", async ({ page }) => {
    const email = uniqueEmail("back");
    await register(page, email, "Bea");
    await ready(page);
    await expect(page.getByRole("heading", { level: 1 })).not.toHaveText(/Glad you’re back/); // first visit

    // Pretend the last visit was eight days ago
    const db = createClient({ url: "file:.test/e2e.db" });
    await db.execute({ sql: "UPDATE users SET last_seen_at = ? WHERE email = ?", args: [Date.now() - 8 * 24 * 3600 * 1000, email] });
    db.close();

    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Glad you’re back, Bea");
    // ... and it stays for this visit, even after the time was saved
    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Glad you’re back, Bea");
  });
});

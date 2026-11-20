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

  test("shows every amount in the chosen display currency, and switches back", async ({ page }) => {
    await register(page, uniqueEmail("view"), "Vera");
    await ready(page);
    await page.getByRole("button", { name: "Add a transaction to Food" }).click();
    await page.getByRole("dialog").locator("#tx-amount").fill("40");
    await page.getByRole("dialog").getByRole("button", { name: "Add", exact: true }).click();
    await expectToast(page, "Transaction added");
    await page.goto("/");
    await ready(page);
    await expect(page.getByText("−$40.00").first()).toBeVisible();

    // Pick euro in the top bar (test rate: 1 USD = 0.5 EUR)
    await page.getByRole("banner").getByRole("combobox", { name: "Display currency" }).click();
    await page.getByPlaceholder("Search by code or name").fill("euro");
    await page.getByRole("option", { name: /EUR/ }).click();
    await expect(page.getByText("−€20.00").first()).toBeVisible(); // expenses card
    await expect(page.getByRole("status").filter({ hasText: "shown in EUR" })).toBeVisible();
    await expect(page.getByText("−$40.00")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Add a transaction to Food" })).toContainText("€20.00");

    // Other pages follow, and so do the chart labels
    await page.goto("/transactions");
    await expect(page.getByText("−€20.00").first()).toBeVisible();
    await page.goto("/analytics");
    await ready(page);
    await expect(page.getByRole("table").getByText("€20.00")).toBeVisible();
    await expect(page.locator(".recharts-surface").first()).toBeVisible();

    // A limit typed while looking at euro is stored in dollars (1 EUR = 2 USD)
    await page.goto("/budgets");
    await ready(page);
    await page.getByRole("button", { name: "New limit" }).first().click();
    await page.getByRole("dialog").getByRole("radio", { name: "Food" }).click();
    await page.getByRole("dialog").locator("#budget-limit").fill("50");
    await page.getByRole("dialog").getByRole("button", { name: "Set limit" }).click();
    await expectToast(page, "Limit set");
    await expect(page.getByText("€30.00 left")).toBeVisible(); // 50 - 20 in euro

    // Back to the main currency: the data was never changed
    await page.getByRole("button", { name: "Show in USD" }).click();
    await expect(page.getByRole("status").filter({ hasText: "shown in EUR" })).toBeHidden(); // wait until it is done
    await page.goto("/budgets");
    await expect(page.getByText("$60.00 left")).toBeVisible(); // 100 - 40 in dollars
    await page.goto("/");
    await expect(page.getByText("−$40.00").first()).toBeVisible();
  });

  test("groups the digits of the amount while typing", async ({ page }) => {
    await register(page, uniqueEmail("digits"), "Dina");
    await ready(page);
    await page.getByRole("button", { name: "Add a transaction to Food" }).click();
    const form = page.getByRole("dialog");
    const amount = form.locator("#tx-amount");
    await amount.pressSequentially("8000");
    await expect(amount).toHaveValue("8 000");
    await amount.fill("");
    await amount.pressSequentially("8000000");
    await expect(amount).toHaveValue("8 000 000");
    // editing in the middle keeps the caret and the grouping
    await amount.press("Home");
    await amount.press("ArrowRight");
    await amount.pressSequentially("1");
    await expect(amount).toHaveValue("81 000 000");
    await amount.fill("");
    await amount.pressSequentially("1234.567");
    await expect(amount).toHaveValue("1 234.56");
    // it is saved as the number, not as text
    await amount.fill("");
    await amount.pressSequentially("12000");
    await form.getByRole("button", { name: "Add", exact: true }).click();
    await expectToast(page, "Transaction added");
    await page.goto("/transactions");
    await expect(page.getByText("−$12,000.00").first()).toBeVisible();
    // editing shows it grouped again
    await page.getByRole("button", { name: /^Food.*12,000/ }).click();
    await expect(page.getByRole("dialog").locator("#tx-amount")).toHaveValue("12 000.00");
  });
});

import { expect, test } from "@playwright/test";
import { addTransaction, expectToast, PASSWORD, ready, register, uniqueEmail } from "./helpers";

test.describe("a new user, from sign-up to charts", () => {
  test("registers, tracks money, sees analytics, switches currency and language, signs out and back in", async ({ page }) => {
    const email = uniqueEmail();

    // --- 1. Sign up -> overview
    await register(page, email, "Ella Tester");
    await expect(page.getByRole("heading", { name: /^(Good morning|Good afternoon|Good evening|Good night), Ella$/ })).toBeVisible();
    await expect(page.getByText("No data for this period").first()).toBeVisible(); // empty state

    // --- 2. A category of my own
    await page.goto("/categories");
    await ready(page);
    await page.getByRole("button", { name: "New category" }).first().click();
    await page.getByRole("dialog").locator("#category-name").fill("Pets");
    await page.getByRole("dialog").getByRole("button", { name: "Create" }).click();
    await expectToast(page, "Category created");
    await expect(page.getByRole("list").getByText("Pets")).toBeVisible();
    await expect(page.getByRole("list").getByText("Food")).toBeVisible(); // standard categories are there

    // --- 3. Transactions
    await page.goto("/");
    await ready(page);
    await addTransaction(page, { type: "Expense", category: "Food", amount: "12.50", note: "Lunch with a friend" });
    await addTransaction(page, { type: "Expense", category: "Pets", amount: "30", note: "Cat food" });
    await addTransaction(page, { type: "Income", category: "Salary", amount: "1000.00", note: "November salary" });

    await page.goto("/transactions");
    await expect(page.getByText("Lunch with a friend")).toBeVisible();
    await expect(page.getByText("−$12.50")).toBeVisible();
    await expect(page.getByText("+$1,000.00").first()).toBeVisible();
    await expect(page.getByText("Today").first()).toBeVisible();

    // search and filter
    await page.getByRole("searchbox").fill("lunch");
    await expect(page.getByText("Cat food")).toBeHidden();
    await expect(page.getByText("Lunch with a friend")).toBeVisible();
    await page.getByRole("searchbox").fill("");
    await page.getByRole("button", { name: "Income", exact: true }).click();
    await expect(page.getByText("November salary")).toBeVisible();
    await expect(page.getByText("Lunch with a friend")).toBeHidden();
    await page.getByRole("button", { name: "All", exact: true }).click();

    // edit, then delete with undo
    await page.getByText("Lunch with a friend").click();
    await page.getByRole("dialog").locator("#tx-amount").fill("15.00");
    await page.getByRole("dialog").getByRole("button", { name: "Save" }).click();
    await expectToast(page, "Transaction saved");
    await expect(page.getByText("−$15.00")).toBeVisible();

    await page.getByRole("button", { name: /Transaction actions: Pets/ }).click();
    await page.getByRole("menuitem", { name: "Delete" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
    await expect(page.getByText("Cat food")).toBeHidden();
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(page.getByText("Cat food")).toBeVisible();

    // --- 4. Overview numbers: income 1000 - expenses (15 + 30)
    await page.goto("/");
    await expect(page.getByText("+$955.00")).toBeVisible(); // balance
    await expect(page.getByText("−$45.00").first()).toBeVisible(); // expenses
    await expect(page.locator(".recharts-surface").first()).toBeVisible(); // the charts have loaded

    // --- 5. Analytics
    await page.goto("/analytics");
    await expect(page.getByRole("heading", { name: "Analytics" })).toBeVisible();
    await expect(page.getByRole("table").getByText("Pets")).toBeVisible();
    await expect(page.locator(".recharts-surface").first()).toBeVisible();
    await page.getByRole("button", { name: "7 days" }).click();
    await expect(page).toHaveURL(/range=week/);

    // --- 6. A monthly limit
    await page.goto("/budgets");
    await ready(page);
    await page.getByRole("button", { name: "New limit" }).first().click();
    await page.getByRole("dialog").getByRole("radio", { name: "Food" }).click();
    await page.getByRole("dialog").locator("#budget-limit").fill("100");
    await page.getByRole("dialog").getByRole("button", { name: "Set limit" }).click();
    await expectToast(page, "Limit set");
    await expect(page.getByText("$85.00 left")).toBeVisible();

    // --- 7. Currency -> euro (every amount is recalculated at the exchange rate; the test rate is 1 USD = 0.5 EUR)
    await page.goto("/settings");
    await ready(page);
    const profileForm = page.locator("form", { has: page.locator("#s-currency") });
    await page.locator("#s-currency").click();
    await page.getByPlaceholder("Search by code or name").fill("euro");
    await page.getByRole("option", { name: /EUR/ }).click();
    await profileForm.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("dialog").getByText("recalculated at today’s exchange rate")).toBeVisible();
    await page.getByRole("button", { name: "Change currency" }).click();
    await expectToast(page, "Settings saved");
    await page.goto("/transactions");
    await expect(page.getByText("€7.50").first()).toBeVisible(); // $15.00 -> €7.50
    await expect(page.getByText("$15.00")).toBeVisible(); // the original amount stays visible

    // --- 8. Export (the CSV of this user only)
    const csv = await page.request.get("/api/export");
    expect(csv.status()).toBe(200);
    expect(csv.headers()["content-type"]).toContain("text/csv");
    const text = await csv.text();
    expect(text).toContain("date,type,category,amount,currency,note");
    expect(text).toContain("7.50,EUR");
    expect(text).toContain("15.00,USD"); // what was typed originally
    expect(text).toContain("Cat food");

    // --- 9. Language -> German; it follows the profile
    await page.goto("/settings");
    await ready(page);
    await page.locator("#s-locale").selectOption("de");
    await page.locator("form", { has: page.locator("#s-locale") }).getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("heading", { name: "Einstellungen", level: 1 })).toBeVisible();
    await page.goto("/categories");
    await expect(page.getByRole("heading", { name: "Kategorien" })).toBeVisible();
    await expect(page.getByRole("list").getByText("Essen")).toBeVisible(); // "Food" in German

    // --- 10. Sign out, wrong password, right password
    await page.getByRole("button", { name: "Profil" }).click();
    await page.getByRole("menuitem", { name: "Abmelden" }).click();
    await expect(page).toHaveURL(/\/login/);
    await ready(page);
    await page.locator("#email").fill(email);
    await page.locator("#password").fill("wrong-password");
    await page.getByRole("button", { name: "Anmelden" }).click();
    await expect(page.getByText("E-Mail oder Passwort ist falsch")).toBeVisible();
    await page.locator("#password").fill(PASSWORD);
    await page.getByRole("button", { name: "Anmelden" }).click();
    await expect(page).toHaveURL("/");
    await expect(page.getByRole("heading", { name: /^(Guten Morgen|Guten Tag|Guten Abend|Gute Nacht), Ella$/ })).toBeVisible();
  });
});

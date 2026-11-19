import { expect, test } from "@playwright/test";
import { addTransaction, ready, register, uniqueEmail } from "./helpers";

/**
 * A walk through every screen in light and dark theme, on a phone and on a computer.
 * It fails on browser errors (including hydration mismatches), on horizontal scrolling,
 * and on pages that show an error screen. Screenshots go to test-results/sweep for a human look.
 */
const PAGES = ["/", "/transactions", "/categories", "/analytics", "/budgets", "/settings"];
const VIEWPORTS = [
  { name: "phone", width: 360, height: 800 },
  { name: "desktop", width: 1280, height: 800 },
];

test("every screen looks right and runs without errors", async ({ page }) => {
  test.setTimeout(240_000);
  const problems: string[] = [];
  page.on("pageerror", (e) => problems.push(`page error: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") problems.push(`console error: ${m.text().slice(0, 200)}`);
  });

  await register(page, uniqueEmail("sweep"), "Sweep Tester");
  await addTransaction(page, { type: "Expense", category: "Food", amount: "42.10", note: "Groceries" });
  await addTransaction(page, { type: "Income", category: "Salary", amount: "2500", note: "Pay day" });
  await page.goto("/budgets");
  await ready(page);
  await page.getByRole("button", { name: "New limit" }).first().click();
  await page.getByRole("dialog").getByRole("radio", { name: "Food" }).click();
  await page.getByRole("dialog").locator("#budget-limit").fill("50");
  await page.getByRole("dialog").getByRole("button", { name: "Set limit" }).click();
  await expect(page.getByText("Limit set").first()).toBeVisible();
  problems.length = 0; // only look at the screens from here on

  for (const theme of ["light", "dark"] as const) {
    await page.evaluate((t) => localStorage.setItem("theme", t), theme);
    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      for (const path of PAGES) {
        const label = `${theme} ${vp.name} ${path}`;
        await page.goto(path);
        await ready(page);
        await page.waitForTimeout(900); // let the soft appearance animation and the charts finish

        await expect(page.locator("html"), label).toHaveClass(theme === "dark" ? /dark/ : /^(?!.*dark)/);
        // no error screen, no 404
        await expect(page.getByText("Something went wrong"), label).toHaveCount(0);
        await expect(page.getByText("Page not found"), label).toHaveCount(0);
        // nothing sticks out sideways
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow, `${label}: horizontal overflow`).toBeLessThanOrEqual(0);

        await page.screenshot({ path: `test-results/sweep/${theme}-${vp.name}-${path === "/" ? "overview" : path.slice(1)}.png`, fullPage: true });
      }
    }
  }

  expect(problems, problems.join("\n")).toEqual([]);
});

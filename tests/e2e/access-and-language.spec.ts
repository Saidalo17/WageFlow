import { expect, test } from "@playwright/test";
import { ready, register, uniqueEmail } from "./helpers";

test.describe("guests", () => {
  test("cannot open the app or download data", async ({ page, request }) => {
    for (const path of ["/", "/transactions", "/analytics", "/budgets", "/categories", "/settings"]) {
      await page.goto(path);
      await expect(page, path).toHaveURL(/\/login$/);
    }
    // the export gives a guest the sign-in page, never a file
    const res = await request.get("/api/export", { maxRedirects: 0 });
    expect([302, 307, 308, 401]).toContain(res.status());
  });

  test("get security headers on every page", async ({ request }) => {
    const res = await request.get("/login");
    const h = res.headers();
    expect(h["content-security-policy"]).toContain("default-src 'self'");
    expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["x-powered-by"]).toBeUndefined();
  });

  test("are sent to sign in, and signed-in users get a helpful 404 for unknown addresses", async ({ page }) => {
    await page.goto("/this-page-does-not-exist");
    await expect(page).toHaveURL(/\/login$/);
    await register(page, uniqueEmail("e2e404"));
    const res = await page.goto("/this-page-does-not-exist");
    expect(res?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  });
});

test.describe("language of the interface", () => {
  const cases = [
    ["Deutsch", "Willkommen zurück", "de"],
    ["Français", "Bon retour", "fr"],
    ["Español", "Te damos la bienvenida", "es"],
    ["Русский", "С возвращением", "ru"],
    ["中文", "欢迎回来", "zh"],
    ["English", "Welcome back", "en"],
  ] as const;

  test("can be switched to each of the six languages on the sign-in page", async ({ page }) => {
    await page.goto("/login");
    await ready(page);
    for (const [label, heading, code] of cases) {
      await page.getByRole("button", { name: /^Language|^Sprache|^Langue|^Idioma|^Язык|^语言/ }).click();
      await page.getByRole("menuitem", { name: label }).click();
      await expect(page.getByRole("heading", { name: heading })).toBeVisible();
      await expect(page.locator("html")).toHaveAttribute("lang", code);
    }
  });

  test("follows the browser language the first time", async ({ browser }) => {
    const context = await browser.newContext({ locale: "ru-RU" });
    const page = await context.newPage();
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "С возвращением" })).toBeVisible();
    await context.close();
  });

  test("sign-up form shows errors in the chosen language", async ({ page }) => {
    await page.goto("/register");
    await ready(page);
    await page.getByRole("button", { name: /^Language/ }).click();
    await page.getByRole("menuitem", { name: "Français" }).click();
    await page.getByRole("button", { name: "Créer le compte" }).click();
    await expect(page.getByText("Ce champ est obligatoire")).toBeVisible();
  });
});

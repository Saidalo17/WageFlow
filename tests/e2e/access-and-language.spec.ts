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
  // The menu lists the languages by their names in the current language, sorted alphabetically.
  const cases = [
    ["de", "Willkommen zurück"],
    ["fr", "Bon retour"],
    ["es", "Te damos la bienvenida"],
    ["ru", "С возвращением"],
    ["zh", "欢迎回来"],
    ["ja", "おかえりなさい"],
    ["ko", "다시 오신 것을 환영합니다"],
    ["tr", "Tekrar hoş geldiniz"],
    ["en", "Welcome back"],
  ] as const;

  test("can be switched to each of the nine languages on the sign-in page", async ({ page }) => {
    await page.goto("/login");
    await ready(page);
    for (const [code, heading] of cases) {
      await page.getByRole("button", { name: /^Language|^Sprache|^Langue|^Idioma|^Язык|^语言|^言語|^언어|^Dil/ }).click();
      await page.locator(`[role="menuitem"][data-locale="${code}"]`).click();
      await expect(page.getByRole("heading", { name: heading })).toBeVisible();
      await expect(page.locator("html")).toHaveAttribute("lang", code);
    }
  });

  test("the language names are translated into the chosen language and stay alphabetical", async ({ page }) => {
    await page.goto("/login");
    await ready(page);
    const names = async () => {
      await page.getByRole("button", { name: /^Language|^Sprache|^Langue|^Idioma|^Язык|^语言|^言語|^언어|^Dil/ }).click();
      const texts = await page.getByRole("menuitem").allInnerTexts();
      await page.keyboard.press("Escape");
      return texts.map((t) => t.trim());
    };
    expect(await names()).toEqual(["Chinese", "English", "French", "German", "Japanese", "Korean", "Russian", "Spanish", "Turkish"]);
    await page.getByRole("button", { name: /^Language/ }).click();
    await page.locator('[role="menuitem"][data-locale="de"]').click();
    await expect(page.getByRole("heading", { name: "Willkommen zurück" })).toBeVisible();
    expect(await names()).toEqual(["Chinesisch", "Deutsch", "Englisch", "Französisch", "Japanisch", "Koreanisch", "Russisch", "Spanisch", "Türkisch"]);
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
    await page.locator('[role="menuitem"][data-locale="fr"]').click();
    await page.getByRole("button", { name: "Créer le compte" }).click();
    await expect(page.getByText("Ce champ est obligatoire")).toBeVisible();
  });
});

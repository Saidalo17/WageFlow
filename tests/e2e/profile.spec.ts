import zlib from "node:zlib";
import { expect, test } from "@playwright/test";
import { expectToast, ready, register, uniqueEmail } from "./helpers";

// A small valid PNG (16x8, solid color), built here so the test needs no image file.
// The browser crops it to a square and re-encodes it before it is uploaded.
function makePng(width: number, height: number): Buffer {
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(zlib.crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 2; // RGB
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(width * 3, 0x66)]);
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
const PNG = makePng(16, 8);

test("decorates the profile: photo, emoji, color and a short text", async ({ page }) => {
  await register(page, uniqueEmail("profile"), "Pia");
  await page.goto("/settings");
  await ready(page);

  const card = page.locator("section", { has: page.getByRole("heading", { name: "Profile card" }) });
  await expect(card).toBeVisible();

  // Emoji, color and text
  await card.getByRole("radio", { name: "🚀" }).click();
  await card.getByRole("radio", { name: "#10B981" }).click();
  await card.locator("#profile-bio").fill("Saving for a trip");
  await expect(card.locator("p", { hasText: "Saving for a trip" })).toBeVisible(); // live preview
  await card.getByRole("button", { name: "Save", exact: true }).click();
  await expectToast(page, "Profile card saved");
  await page.reload();
  await ready(page);
  await expect(card.locator("#profile-bio")).toHaveValue("Saving for a trip");
  await expect(card.getByRole("radio", { name: "🚀" })).toHaveAttribute("aria-checked", "true");
  // the emoji replaces the letter in the top bar until there is a photo
  await expect(page.getByRole("banner").getByText("🚀")).toBeVisible();

  // Photo
  await expect(page.getByRole("banner").locator("img")).toHaveCount(0);
  await page.getByTestId("avatar-input").setInputFiles({ name: "me.png", mimeType: "image/png", buffer: PNG });
  await expectToast(page, "Photo updated");
  const img = page.getByRole("banner").locator("img");
  await expect(img).toBeVisible();
  const src = await img.getAttribute("src");
  expect(src).toMatch(/^\/api\/avatar\?v=\d+$/);
  const res = await page.request.get(src!);
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toMatch(/^image\/(webp|jpeg)$/);
  expect(res.headers()["x-content-type-options"]).toBe("nosniff");

  // Not an image
  await page.getByTestId("avatar-input").setInputFiles({ name: "evil.png", mimeType: "image/png", buffer: Buffer.from("<svg onload=alert(1)>") });
  await expect(page.getByRole("alert").filter({ hasText: "Choose a JPG, PNG or WebP picture" })).toBeVisible();

  // Remove it
  await page.getByRole("button", { name: "Remove photo" }).click();
  await expectToast(page, "Photo removed");
  await expect(page.getByRole("banner").locator("img")).toHaveCount(0);
  expect((await page.request.get(src!)).status()).toBe(404);
});

test("the photo address is private: guests get nothing", async ({ browser }) => {
  const guest = await browser.newContext();
  const res = await guest.request.get("/api/avatar", { maxRedirects: 0 });
  expect([307, 401]).toContain(res.status());
  await guest.close();
});

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_CATEGORIES } from "@/lib/default-categories";
import { isLocale, locales, matchLocale } from "@/i18n/config";
import { checkMessages } from "../../scripts/i18n-check.mjs";

const messagesDir = path.join(process.cwd(), "src", "messages");

describe("translations", () => {
  it("all six languages have the same keys and placeholders as English", () => {
    expect(checkMessages()).toEqual([]);
  });

  it("there is a file for every supported language", () => {
    for (const locale of locales) expect(fs.existsSync(path.join(messagesDir, `${locale}.json`)), locale).toBe(true);
  });

  it("every standard category has a translated name in every language", () => {
    for (const locale of locales) {
      const json = JSON.parse(fs.readFileSync(path.join(messagesDir, `${locale}.json`), "utf8"));
      for (const c of DEFAULT_CATEGORIES) {
        expect(json.categories.system[c.systemKey], `${locale}:${c.systemKey}`).toBeTruthy();
      }
    }
  });

  it("system keys are unique", () => {
    const keys = DEFAULT_CATEGORIES.map((c) => c.systemKey);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("choosing the language", () => {
  it("recognises the six languages", () => {
    for (const l of locales) expect(isLocale(l)).toBe(true);
    for (const l of ["it", "EN", "", undefined, null, 5]) expect(isLocale(l)).toBe(false);
  });

  it("picks the best language from the browser header, English as fallback", () => {
    expect(matchLocale("ru-RU,ru;q=0.9,en;q=0.8")).toBe("ru");
    expect(matchLocale("de-DE")).toBe("de");
    expect(matchLocale("zh-CN,zh;q=0.9")).toBe("zh");
    expect(matchLocale("it-IT,it;q=0.9,fr;q=0.8")).toBe("fr"); // first supported one
    expect(matchLocale("ja-JP")).toBe("en");
    expect(matchLocale(null)).toBe("en");
    expect(matchLocale("")).toBe("en");
  });
});

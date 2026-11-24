import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_CATEGORIES } from "@/lib/default-categories";
import { isLocale, locales, matchLocale } from "@/i18n/config";
import { checkMessages } from "../../scripts/i18n-check.mjs";

const messagesDir = path.join(process.cwd(), "src", "messages");

describe("translations", () => {
  it("all ten languages have the same keys and placeholders as English", () => {
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

describe("language list", () => {
  it("shows every language by its name in the interface language, sorted alphabetically", async () => {
    const { languageOptions } = await import("@/i18n/language-names");
    const en = languageOptions("en").map((o) => o.label);
    expect(en).toEqual(["Arabic", "Chinese", "English", "French", "German", "Japanese", "Korean", "Russian", "Spanish", "Turkish"]);
    expect(languageOptions("ru").map((o) => o.label)).toEqual([
      "Арабский", "Испанский", "Китайский", "Корейский", "Немецкий", "Русский", "Турецкий", "Французский", "Английский", "Японский",
    ].sort(new Intl.Collator("ru").compare));
    expect(languageOptions("de").map((o) => o.label)).toContain("Französisch");
    for (const ui of locales) {
      const options = languageOptions(ui);
      expect(options.map((o) => o.code).sort()).toEqual([...locales].sort()); // all ten, once each
      const collator = new Intl.Collator(ui);
      const labels = options.map((o) => o.label);
      expect(labels, ui).toEqual([...labels].sort(collator.compare));
      expect(new Set(labels).size).toBe(labels.length);
    }
  });
});

describe("choosing the language", () => {
  it("recognises the ten languages", () => {
    for (const l of locales) expect(isLocale(l)).toBe(true);
    for (const l of ["it", "pl", "EN", "", undefined, null, 5]) expect(isLocale(l)).toBe(false);
  });

  it("picks the best language from the browser header, English as fallback", () => {
    expect(matchLocale("ru-RU,ru;q=0.9,en;q=0.8")).toBe("ru");
    expect(matchLocale("de-DE")).toBe("de");
    expect(matchLocale("zh-CN,zh;q=0.9")).toBe("zh");
    expect(matchLocale("it-IT,it;q=0.9,fr;q=0.8")).toBe("fr"); // first supported one
    expect(matchLocale("ja-JP")).toBe("ja");
    expect(matchLocale("ko-KR,ko;q=0.9")).toBe("ko");
    expect(matchLocale("tr-TR")).toBe("tr");
    expect(matchLocale("pl-PL")).toBe("en");
    expect(matchLocale(null)).toBe("en");
    expect(matchLocale("")).toBe("en");
  });
});

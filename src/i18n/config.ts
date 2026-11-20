/** Shown in this order everywhere: alphabetical by the English name of the language. */
export const locales = ["zh", "en", "fr", "de", "ja", "ko", "ru", "es", "tr"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";
export const LOCALE_COOKIE = "NEXT_LOCALE";

/** Language names are written in English, so they are readable whatever the interface language is. */
export const localeLabels: Record<Locale, string> = {
  zh: "Chinese",
  en: "English",
  fr: "French",
  de: "German",
  ja: "Japanese",
  ko: "Korean",
  ru: "Russian",
  es: "Spanish",
  tr: "Turkish",
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (locales as readonly string[]).includes(value);
}

/** Picks the best supported locale from an Accept-Language header. */
export function matchLocale(header: string | null | undefined): Locale {
  if (!header) return defaultLocale;
  const wanted = header
    .split(",")
    .map((part) => part.trim().split(";")[0].toLowerCase().split("-")[0])
    .filter(Boolean);
  for (const code of wanted) {
    if (isLocale(code)) return code;
  }
  return defaultLocale;
}

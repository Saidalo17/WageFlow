import { localeLabels, locales, type Locale } from "./config";

/**
 * The supported languages with their names written in the language the interface is in
 * ("Spanish" in English, "Испанский" in Russian, "Spanisch" in German),
 * sorted alphabetically by the rules of that same language.
 */
export function languageOptions(uiLocale: string): { code: Locale; label: string }[] {
  const names = new Intl.DisplayNames([uiLocale], { type: "language" });
  const collator = new Intl.Collator(uiLocale);
  return locales
    .map((code) => {
      const name = names.of(code) ?? localeLabels[code];
      return { code, label: name.charAt(0).toLocaleUpperCase(uiLocale) + name.slice(1) };
    })
    .sort((a, b) => collator.compare(a.label, b.label));
}

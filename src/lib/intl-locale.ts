/**
 * The locale handed to Intl. Arabic is formatted with Western digits (1,250.00), the way people in most Arabic-speaking
 * countries write amounts, and the way the amount fields read what they type.
 */
export function intlLocale(locale: string): string {
  return locale === "ar" ? "ar-u-nu-latn" : locale;
}

/** Languages written right to left. */
export const RTL_LOCALES = ["ar"];

export function dirOf(locale: string): "rtl" | "ltr" {
  return RTL_LOCALES.includes(locale) ? "rtl" : "ltr";
}

import { intlLocale } from "@/lib/intl-locale";
/**
 * Money helpers. Amounts are stored as integers in minor units
 * (cents, kopecks...). The number of decimals depends on the currency:
 * JPY = 0, USD = 2, KWD = 3.
 */

const digitsCache = new Map<string, number>();

export function minorDigits(currency: string): number {
  let d = digitsCache.get(currency);
  if (d === undefined) {
    d = new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions()
      .maximumFractionDigits ?? 2;
    digitsCache.set(currency, d);
  }
  return d;
}

/** 1250.5 USD -> 125050 */
export function toMinor(amount: number, currency: string): number {
  return Math.round(amount * 10 ** minorDigits(currency));
}

/** 125050 USD -> 1250.5 */
export function fromMinor(minor: number, currency: string): number {
  return minor / 10 ** minorDigits(currency);
}

/** Formatted for display: "$1,250.00", "1 250,00 ₽", "¥1,250". */
export function formatMoney(
  minor: number,
  currency: string,
  locale: string,
  options: Intl.NumberFormatOptions = {},
): string {
  return new Intl.NumberFormat(intlLocale(locale), {
    style: "currency",
    currency,
    ...options,
  }).format(fromMinor(minor, currency));
}

/**
 * Parses user input like "1250,50" or "1 250.50" using the locale's decimal
 * separator. Returns null when the text is not a valid amount.
 */
export function parseAmount(input: string, locale: string): number | null {
  const parts = new Intl.NumberFormat(intlLocale(locale)).formatToParts(12345.6);
  const decimal = parts.find((p) => p.type === "decimal")?.value ?? ".";
  let s = input.trim().replace(/[\s  ']/g, "");
  if (!s) return null;
  // Accept both "," and "." as a decimal mark when only one kind is present.
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  if (hasComma && hasDot) {
    // The last separator is the decimal one; the other is a thousands mark.
    const last = Math.max(s.lastIndexOf(","), s.lastIndexOf("."));
    s = s.slice(0, last).replace(/[.,]/g, "") + "." + s.slice(last + 1);
  } else if (hasComma || hasDot) {
    const sep = hasComma ? "," : ".";
    const count = s.split(sep).length - 1;
    s = count > 1 && sep !== decimal ? s.split(sep).join("") : s.replace(sep, ".");
  }
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  return Number(s);
}

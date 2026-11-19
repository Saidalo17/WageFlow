import { fromMinor, minorDigits, parseAmount } from "@/lib/money";
import { MAX_AMOUNT_MAJOR } from "@/lib/validators/transaction";

/** Symbol of a currency in the user's language: "₽", "$", "€", "¥". */
export function currencySymbol(locale: string, currency: string) {
  return (
    new Intl.NumberFormat(locale, { style: "currency", currency, currencyDisplay: "narrowSymbol" })
      .formatToParts(0)
      .find((p) => p.type === "currency")?.value ?? currency
  );
}

/** 125050 minor units -> "1250,50" in the user's language, without thousands separators, ready to edit. */
export function editableAmount(minor: number, currency: string, locale: string) {
  const d = minorDigits(currency);
  return new Intl.NumberFormat(locale, {
    useGrouping: false,
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  }).format(fromMinor(minor, currency));
}

export type AmountResult = { ok: true; minor: number } | { ok: false; error: "amountRequired" | "amountInvalid" | "amountTooLarge" };

/** Turns typed text ("1 250,50") into minor units, or says what is wrong with it. */
export function parseMinorAmount(text: string, locale: string, currency: string): AmountResult {
  if (!text.trim()) return { ok: false, error: "amountRequired" };
  const n = parseAmount(text, locale);
  if (n === null || n <= 0) return { ok: false, error: "amountInvalid" };
  const d = minorDigits(currency);
  const minor = Math.round(n * 10 ** d);
  if (Math.abs(n * 10 ** d - minor) > 1e-6) return { ok: false, error: "amountInvalid" }; // too many decimals
  if (n > MAX_AMOUNT_MAJOR) return { ok: false, error: "amountTooLarge" };
  return { ok: true, minor };
}

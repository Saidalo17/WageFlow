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

/**
 * Formats an amount while it is being typed: groups the digits in threes with spaces
 * ("8000000" -> "8 000 000") and keeps at most as many decimals as the currency has.
 * The decimal mark is whatever the user typed (comma or dot). Letters and other characters are dropped.
 */
export function formatAmountInput(raw: string, currency: string): string {
  const decimals = minorDigits(currency);
  const sepIndex = raw.search(/[.,]/);
  const hasSep = sepIndex !== -1 && decimals > 0;
  const sep = hasSep ? raw[sepIndex] : "";
  const intRaw = (hasSep ? raw.slice(0, sepIndex) : sepIndex === -1 ? raw : raw.slice(0, sepIndex)).replace(/\D/g, "");
  const fracRaw = hasSep ? raw.slice(sepIndex + 1).replace(/\D/g, "").slice(0, decimals) : "";
  if (intRaw === "" && !hasSep) return "";
  const int = intRaw.replace(/^0+(?=\d)/, "") || "0";
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return hasSep ? `${grouped}${sep}${fracRaw}` : grouped;
}

/** How many digits and decimal marks are before the caret (used to put the caret back after reformatting). */
export function significantBefore(text: string, caret: number): number {
  return text.slice(0, caret).replace(/[^\d.,]/g, "").length;
}

/** Caret position in `formatted` after the same number of digits/decimal marks. */
export function caretAfter(formatted: string, significant: number): number {
  if (significant <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < formatted.length; i++) {
    if (/[\d.,]/.test(formatted[i])) seen += 1;
    if (seen === significant) return i + 1;
  }
  return formatted.length;
}

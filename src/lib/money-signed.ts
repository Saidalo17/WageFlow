import { parseAmount } from "@/lib/money";
import { parseMinorAmount, type AmountResult } from "@/lib/money-input";

/**
 * A balance typed in a form: empty or 0 is fine (a new account may start at zero), and a separate
 * "negative" switch gives the sign (a credit card balance, an overdraft), so nobody has to type a minus.
 */
export function parseSignedMinor(
  text: string,
  negative: boolean,
  locale: string,
  currency: string,
): AmountResult | { ok: true; minor: number } {
  if (!text.trim() || parseAmount(text, locale) === 0) return { ok: true, minor: 0 };
  const r = parseMinorAmount(text, locale, currency);
  if (!r.ok) return r;
  return { ok: true, minor: negative ? -r.minor : r.minor };
}

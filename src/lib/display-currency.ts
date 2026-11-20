import { cookies } from "next/headers";
import { cache } from "react";
import { isValidCurrency } from "@/lib/currencies";
import { getLatestTable, minorMultiplier, rateFromTable } from "@/lib/fx";

export const DISPLAY_CURRENCY_COOKIE = "DISPLAY_CURRENCY";

export type Display = {
  /** The currency amounts are shown in right now. */
  currency: string;
  /** True when it differs from the user's main currency (amounts are converted for display only). */
  active: boolean;
  /** True when the user asked for another currency but today's rates could not be loaded. */
  failed: boolean;
  /** Turns minor units of the main currency into minor units of the display currency. */
  convert: (minor: number) => number;
};

const identity = (minor: number) => minor;

/**
 * The currency to show amounts in. The data itself always stays in the user's main currency;
 * this only changes how it is shown (at today's exchange rate), so it can be switched back and forth freely.
 * The choice is remembered in a cookie of this browser.
 */
export const getDisplay = cache(async (mainCurrency: string): Promise<Display> => {
  const wanted = (await cookies()).get(DISPLAY_CURRENCY_COOKIE)?.value;
  if (!wanted || wanted === mainCurrency || !isValidCurrency(wanted)) {
    return { currency: mainCurrency, active: false, failed: false, convert: identity };
  }
  try {
    const table = await getLatestTable();
    const factor = minorMultiplier(mainCurrency, wanted, rateFromTable(table, mainCurrency, wanted));
    return { currency: wanted, active: true, failed: false, convert: (minor) => Math.round(minor * factor) };
  } catch {
    return { currency: mainCurrency, active: false, failed: true, convert: identity };
  }
});

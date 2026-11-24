import { intlLocale } from "@/lib/intl-locale";

/** All ISO 4217 currencies, with names in the interface language. */

export const POPULAR_CURRENCIES = ["USD", "EUR", "GBP", "CNY", "RUB", "JPY", "CHF"];

/**
 * Every currency code the app knows, kept here so the list is the same on every device. Browsers differ:
 * `Intl.supportedValuesOf("currency")` is missing in some mobile browsers and shorter in others, which is how
 * a phone ended up with fewer currencies than a computer. The browser's own list is only added on top.
 */
const KNOWN = (
  "AED AFN ALL AMD ANG AOA ARS AUD AWG AZN BAM BBD BDT BGN BHD BIF BMD BND BOB BRL BSD BTN BWP BYN BZD " +
  "CAD CDF CHF CLP CNY COP CRC CUC CUP CVE CZK DJF DKK DOP DZD EGP ERN ETB EUR FJD FKP GBP GEL GHS GIP GMD " +
  "GNF GTQ GYD HKD HNL HRK HTG HUF IDR ILS INR IQD IRR ISK JMD JOD JPY KES KGS KHR KMF KPW KRW KWD KYD KZT " +
  "LAK LBP LKR LRD LSL LYD MAD MDL MGA MKD MMK MNT MOP MRU MUR MVR MWK MXN MYR MZN NAD NGN NIO NOK NPR " +
  "NZD OMR PAB PEN PGK PHP PKR PLN PYG QAR RON RSD RUB RWF SAR SBD SCR SDG SEK SGD SHP SLE SLL SOS SRD SSP " +
  "STN SVC SYP SZL THB TJS TMT TND TOP TRY TTD TWD TZS UAH UGX USD UYU UZS VES VND VUV WST XAF XCD XCG XDR " +
  "XOF XPF XSU YER ZAR ZMW ZWG ZWL"
).split(" ");

export type CurrencyInfo = { code: string; name: string; symbol: string };

let cached: string[] | null = null;

export function getCurrencyCodes(): string[] {
  if (cached) return cached;
  let fromBrowser: string[] = [];
  try {
    fromBrowser = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.("currency") ?? [];
  } catch {
    /* an older browser: the built-in list is enough */
  }
  cached = [...new Set([...KNOWN, ...fromBrowser])].sort();
  return cached;
}

export function isValidCurrency(code: string): boolean {
  return getCurrencyCodes().includes(code);
}

export function getCurrencies(locale: string): CurrencyInfo[] {
  const names = safeNames(locale);
  const collator = new Intl.Collator(locale);
  return getCurrencyCodes()
    .map((code) => {
      let symbol = code;
      try {
        symbol =
          new Intl.NumberFormat(intlLocale(locale), { style: "currency", currency: code, currencyDisplay: "narrowSymbol" })
            .formatToParts(0)
            .find((p) => p.type === "currency")?.value ?? code;
      } catch {
        /* a browser that does not know this code: show the code itself */
      }
      return { code, name: names(code), symbol };
    })
    .sort((a, b) => collator.compare(a.name, b.name));
}

/** Currency names in the interface language; the code itself where the browser has no name for it. */
function safeNames(locale: string): (code: string) => string {
  try {
    const names = new Intl.DisplayNames([locale], { type: "currency" });
    return (code) => {
      try {
        return names.of(code) ?? code;
      } catch {
        return code;
      }
    };
  } catch {
    return (code) => code;
  }
}

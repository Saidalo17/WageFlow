/** All ISO 4217 currencies, with names in the interface language. */

export const POPULAR_CURRENCIES = ["USD", "EUR", "GBP", "CNY", "RUB", "JPY", "CHF"];

/** Fallback when Intl.supportedValuesOf is unavailable. */
const FALLBACK = (
  "AED AFN ALL AMD ANG AOA ARS AUD AWG AZN BAM BBD BDT BGN BHD BIF BMD BND BOB BRL BSD BTN BWP BYN BZD " +
  "CAD CDF CHF CLP CNY COP CRC CUP CVE CZK DJF DKK DOP DZD EGP ERN ETB EUR FJD FKP GBP GEL GHS GIP GMD " +
  "GNF GTQ GYD HKD HNL HTG HUF IDR ILS INR IQD IRR ISK JMD JOD JPY KES KGS KHR KMF KPW KRW KWD KYD KZT " +
  "LAK LBP LKR LRD LSL LYD MAD MDL MGA MKD MMK MNT MOP MRU MUR MVR MWK MXN MYR MZN NAD NGN NIO NOK NPR " +
  "NZD OMR PAB PEN PGK PHP PKR PLN PYG QAR RON RSD RUB RWF SAR SBD SCR SDG SEK SGD SHP SLE SOS SRD SSP " +
  "STN SYP SZL THB TJS TMT TND TOP TRY TTD TWD TZS UAH UGX USD UYU UZS VES VND VUV WST XAF XCD XOF XPF " +
  "YER ZAR ZMW ZWG"
).split(" ");

export type CurrencyInfo = { code: string; name: string; symbol: string };

export function getCurrencyCodes(): string[] {
  try {
    const list = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] })
      .supportedValuesOf?.("currency");
    if (list && list.length > 0) return list;
  } catch {
    /* fall through */
  }
  return FALLBACK;
}

export function isValidCurrency(code: string): boolean {
  return getCurrencyCodes().includes(code);
}

export function getCurrencies(locale: string): CurrencyInfo[] {
  const names = new Intl.DisplayNames([locale], { type: "currency" });
  const collator = new Intl.Collator(locale);
  return getCurrencyCodes()
    .map((code) => {
      const symbol =
        new Intl.NumberFormat(locale, { style: "currency", currency: code, currencyDisplay: "narrowSymbol" })
          .formatToParts(0)
          .find((p) => p.type === "currency")?.value ?? code;
      return { code, name: names.of(code) ?? code, symbol };
    })
    .sort((a, b) => collator.compare(a.name, b.name));
}

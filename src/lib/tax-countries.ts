import { TAX_COUNTRIES, taxCurrency, type TaxCountry } from "@/lib/tax";

export type CountryOption = { code: TaxCountry; name: string; currency: string };

/** Countries with tax rules, named in the interface language and sorted by name. */
export function countryOptions(locale: string): CountryOption[] {
  let names: Intl.DisplayNames | null = null;
  try {
    names = new Intl.DisplayNames([locale], { type: "region" });
  } catch {
    /* fall back to the codes */
  }
  return TAX_COUNTRIES.map((code) => ({ code, name: names?.of(code) ?? code, currency: taxCurrency(code) })).sort(
    (a, b) => a.name.localeCompare(b.name, locale),
  );
}

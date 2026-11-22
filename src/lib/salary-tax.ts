import { calculateSalary, type SalaryInput, type SalaryResult } from "@/lib/salary";
import { computeTaxes, type TaxCountry, type TaxLine } from "@/lib/tax";

export type TaxedSalary = {
  result: SalaryResult;
  /** Taxes added by the country rules (already part of `result.deductions`). */
  taxes: TaxLine[];
  /** The country's rules are in another currency than the amounts, so none were applied. */
  currencyMismatch: boolean;
};

/**
 * The salary calculation with a country's taxes added as deductions, in front of the hand-entered ones.
 * Taxes are worked out from the gross pay (base + overtime + bonuses). Used by the calculator in the browser
 * and again on the server when saving.
 */
export function calculateWithTaxes(
  input: SalaryInput,
  country: TaxCountry | null,
  currency: string,
): TaxedSalary {
  const plain = calculateSalary(input);
  if (!country) return { result: plain, taxes: [], currencyMismatch: false };

  const taxes = computeTaxes(country, plain.gross, currency);
  if (taxes === null) return { result: plain, taxes: [], currencyMismatch: true };

  const result = calculateSalary({
    ...input,
    deductions: [...taxes.map((t) => ({ label: t.key, kind: "fixed" as const, value: t.amount })), ...input.deductions],
  });
  return { result, taxes, currencyMismatch: false };
}

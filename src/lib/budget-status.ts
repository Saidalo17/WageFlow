export type BudgetStatus = "ok" | "warning" | "over";

/** Under 80% is calm, 80-100% is a warning, above 100% means the limit is exceeded. */
export function budgetStatus(ratio: number): BudgetStatus {
  if (ratio > 1) return "over";
  if (ratio >= 0.8) return "warning";
  return "ok";
}

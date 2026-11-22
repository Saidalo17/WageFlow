/**
 * Short, rule-based observations about the period on the dashboard ("insights"). No guesswork and no outside
 * service: every line is a plain rule over the user's own numbers. Pure functions; money in minor units,
 * shares and changes as fractions (0.25 = 25%).
 */

export type InsightTone = "good" | "warn" | "info";

export type Insight = {
  /** Translation key under overview.insights.<key>. */
  key: string;
  tone: InsightTone;
  /** Raw numbers and names; the page formats them in the user's language. */
  values: { percent?: number; amount?: number; name?: string };
};

export type InsightInput = {
  income: number;
  expense: number;
  /** Expenses of the comparison period; 0 when there is none. */
  previousExpense: number;
  /** Expense categories of the period, biggest first. */
  categories: { name: string; total: number }[];
  budgets: { name: string; spent: number; limit: number }[];
};

const MAX_INSIGHTS = 4;
const TONE_ORDER: Record<InsightTone, number> = { warn: 0, good: 1, info: 2 };

export function buildInsights(input: InsightInput): Insight[] {
  const out: Insight[] = [];
  const { income, expense, previousExpense, categories, budgets } = input;

  // What is saved from the income
  if (income > 0) {
    const rate = (income - expense) / income;
    if (rate < 0) out.push({ key: "overspent", tone: "warn", values: { amount: expense - income } });
    else if (rate >= 0.2) out.push({ key: "savingsGood", tone: "good", values: { percent: rate } });
    else out.push({ key: "savingsLow", tone: "info", values: { percent: rate } });
  }

  // Spending against the previous period
  if (previousExpense > 0 && expense > 0) {
    const change = (expense - previousExpense) / previousExpense;
    if (change >= 0.15) out.push({ key: "spendUp", tone: "warn", values: { percent: change } });
    else if (change <= -0.15) out.push({ key: "spendDown", tone: "good", values: { percent: -change } });
  }

  // One category taking a big part of the spending
  if (expense > 0 && categories[0]) {
    const share = categories[0].total / expense;
    if (share >= 0.3) out.push({ key: "topCategory", tone: "info", values: { name: categories[0].name, percent: share } });
  }

  // The limit that is closest to (or past) its edge
  const worst = [...budgets]
    .filter((b) => b.limit > 0)
    .map((b) => ({ ...b, ratio: b.spent / b.limit }))
    .sort((a, b) => b.ratio - a.ratio)[0];
  if (worst && worst.ratio >= 1) out.push({ key: "budgetOver", tone: "warn", values: { name: worst.name } });
  else if (worst && worst.ratio >= 0.8) out.push({ key: "budgetNear", tone: "warn", values: { name: worst.name, percent: worst.ratio } });

  return out.sort((a, b) => TONE_ORDER[a.tone] - TONE_ORDER[b.tone]).slice(0, MAX_INSIGHTS);
}

/**
 * Debt maths: what is left, how far along it is, when the next payment is due and when the debt could be paid off.
 * Pure functions; money in minor units, dates "YYYY-MM-DD", rates in hundredths of a percent per year (12.5% = 1250).
 */

export const DEBT_DIRECTIONS = ["owed_by_me", "owed_to_me"] as const;
export type DebtDirection = (typeof DEBT_DIRECTIONS)[number];

export const DEBT_KINDS = ["loan", "credit_card", "mortgage", "personal", "other"] as const;
export type DebtKind = (typeof DEBT_KINDS)[number];

/** What is still to be paid. Payments beyond the principal do not make it negative. */
export function remaining(principal: number, paid: number): number {
  return Math.max(principal - paid, 0);
}

/** 0..1: how much of the principal has been paid. */
export function progress(principal: number, paid: number): number {
  return principal > 0 ? Math.min(Math.max(paid / principal, 0), 1) : 0;
}

export type Payoff = {
  /** Months of regular payments until the debt is gone. */
  months: number;
  /** Interest that will be paid on the way (an estimate: the last payment is usually smaller). */
  interest: number;
};

/**
 * How long the debt takes to pay off with a fixed monthly payment, and what the interest comes to.
 * Returns null when there is nothing to estimate (no payment given, nothing left) or when the payment does not
 * even cover the interest, so the debt would never shrink.
 */
export function payoff(left: number, ratePerYear: number, monthly: number | null): Payoff | null {
  if (left <= 0 || !monthly || monthly <= 0) return null;
  const r = ratePerYear / 10_000 / 12; // monthly interest as a fraction
  if (r === 0) return { months: Math.ceil(left / monthly), interest: 0 };
  if (monthly <= r * left) return null;
  const months = Math.ceil(-Math.log(1 - (r * left) / monthly) / Math.log(1 + r));
  // Simulate the last stretch exactly so the interest total matches what the payments really cost.
  let balance = left;
  let interest = 0;
  for (let i = 0; i < months && balance > 0; i++) {
    const charge = Math.round(balance * r);
    interest += charge;
    balance = balance + charge - Math.min(monthly, balance + charge);
  }
  return { months, interest };
}

/** The next date (today or later) the payment falls on. A day after the month's end uses the last day. */
export function nextPaymentDate(paymentDay: number | null, today: string): string | null {
  if (!paymentDay) return null;
  const [y, m] = today.split("-").map(Number);
  const pick = (year: number, month: number) => {
    const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return `${year}-${String(month).padStart(2, "0")}-${String(Math.min(paymentDay, last)).padStart(2, "0")}`;
  };
  const thisMonth = pick(y, m);
  if (thisMonth >= today) return thisMonth;
  return m === 12 ? pick(y + 1, 1) : pick(y, m + 1);
}

export type DebtSummaryInput = {
  direction: DebtDirection;
  currency: string;
  principal: number;
  paid: number;
};

/** Remaining amounts of the open debts, split by direction (all in each debt's own currency). */
export function openAmounts(debts: DebtSummaryInput[]) {
  return debts
    .map((d) => ({ ...d, left: remaining(d.principal, d.paid) }))
    .filter((d) => d.left > 0);
}

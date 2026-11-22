/**
 * Salary maths. Pure functions, used by the calculator in the browser and again on the server when saving,
 * so the saved numbers never depend on what the browser sent.
 *
 * Money is in minor units (cents). Hours, days and the overtime multiplier are in hundredths
 * (160.5 h = 16050, 1.5x = 150), a percentage deduction in hundredths of a percent (13% = 1300).
 */

export const SALARY_MODES = ["monthly", "hourly", "daily"] as const;
export type SalaryMode = (typeof SALARY_MODES)[number];

export type Deduction = {
  label: string;
  kind: "percent" | "fixed";
  /** percent: hundredths of a percent of the gross pay; fixed: minor units. */
  value: number;
};

export type SalaryInput = {
  mode: SalaryMode;
  /** Monthly salary, hourly rate or daily rate (minor units), depending on mode. */
  rate: number;
  /** Hours (hourly) or days (daily) worked, hundredths. Ignored for monthly. */
  quantity: number;
  /** Standard hours per month / per day, hundredths. */
  monthHours: number;
  dayHours: number;
  overtimeHours: number;
  overtimeMultiplier: number;
  /** Bonus and premium amounts, minor units. */
  bonuses: number[];
  deductions: Deduction[];
};

export type SalaryResult = {
  basePay: number;
  overtimePay: number;
  bonusTotal: number;
  /** Pay before deductions. */
  gross: number;
  deductions: (Deduction & { amount: number })[];
  deductionTotal: number;
  /** Pay after deductions. Negative when the deductions are larger than the gross pay. */
  net: number;
  /** What one hour / one day of this salary is worth (minor units, gross, without overtime and bonuses). */
  hourlyRate: number;
  dailyRate: number;
};

export const DEFAULT_MONTH_HOURS = 16000;
export const DEFAULT_DAY_HOURS = 800;
export const DEFAULT_OVERTIME_MULTIPLIER = 150;

export function calculateSalary(input: SalaryInput): SalaryResult {
  const monthHours = input.monthHours > 0 ? input.monthHours : DEFAULT_MONTH_HOURS;
  const dayHours = input.dayHours > 0 ? input.dayHours : DEFAULT_DAY_HOURS;

  // Exact (unrounded) hourly rate; each result is rounded once.
  let hourly: number;
  if (input.mode === "monthly") hourly = (input.rate * 100) / monthHours;
  else if (input.mode === "daily") hourly = (input.rate * 100) / dayHours;
  else hourly = input.rate;

  const basePay =
    input.mode === "monthly" ? input.rate : Math.round((input.rate * input.quantity) / 100);
  const overtimePay = Math.round(((hourly * input.overtimeHours) / 100) * (input.overtimeMultiplier / 100));
  const bonusTotal = input.bonuses.reduce((s, b) => s + b, 0);
  const gross = basePay + overtimePay + bonusTotal;

  const deductions = input.deductions.map((d) => ({
    ...d,
    amount: d.kind === "percent" ? Math.round((gross * d.value) / 10000) : d.value,
  }));
  const deductionTotal = deductions.reduce((s, d) => s + d.amount, 0);

  return {
    basePay,
    overtimePay,
    bonusTotal,
    gross,
    deductions,
    deductionTotal,
    net: gross - deductionTotal,
    hourlyRate: Math.round(hourly),
    dailyRate: Math.round((hourly * dayHours) / 100),
  };
}

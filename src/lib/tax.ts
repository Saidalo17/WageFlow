/**
 * Approximate employee-side taxes and contributions by country.
 *
 * These are ESTIMATES for planning, not payslips: they use the published rates of one tax year, a single
 * person without children, no allowances beyond the standard ones, and they treat the gross pay of the
 * calculation as if every month of the year paid the same. Regional and church taxes are not included.
 * To add a country: add its code to TAX_COUNTRIES and a rule to RULES; the rest of the app follows.
 */

import { minorDigits } from "@/lib/money";

export const TAX_COUNTRIES = ["RU", "US", "DE", "ES", "FR", "JP", "KR", "TR", "CN", "UZ"] as const;
export type TaxCountry = (typeof TAX_COUNTRIES)[number];

export function isTaxCountry(value: unknown): value is TaxCountry {
  return typeof value === "string" && (TAX_COUNTRIES as readonly string[]).includes(value);
}

/** One tax or contribution. `key` is a translation key (salary.tax.items.<key>); amounts are minor units per month. */
export type TaxLine = { key: string; amount: number };

type Bracket = { upTo: number; rate: number };

/** Tax on `amount` with marginal rates; the last bracket has upTo = Infinity. */
function progressive(amount: number, brackets: Bracket[]): number {
  let tax = 0;
  let from = 0;
  for (const b of brackets) {
    if (amount > from) tax += (Math.min(amount, b.upTo) - from) * b.rate;
    from = b.upTo;
    if (amount <= b.upTo) break;
  }
  return tax;
}

type Rule = {
  currency: string;
  /** Tax year the numbers are taken from. */
  year: number;
  /** Yearly taxes for a yearly gross pay (both in major units). */
  annual: (gross: number) => { key: string; amount: number }[];
};

const US_BRACKETS: Bracket[] = [
  { upTo: 11_925, rate: 0.1 },
  { upTo: 48_475, rate: 0.12 },
  { upTo: 103_350, rate: 0.22 },
  { upTo: 197_300, rate: 0.24 },
  { upTo: 250_525, rate: 0.32 },
  { upTo: 626_350, rate: 0.35 },
  { upTo: Infinity, rate: 0.37 },
];

/** German income tax 2025 (basic tariff, single). `zve` is the taxable income in whole euros. */
function germanIncomeTax(zve: number): number {
  const x = Math.floor(zve);
  if (x <= 12_096) return 0;
  if (x <= 17_443) {
    const y = (x - 12_096) / 10_000;
    return Math.floor((932.3 * y + 1_400) * y);
  }
  if (x <= 68_480) {
    const z = (x - 17_443) / 10_000;
    return Math.floor((176.64 * z + 2_397) * z + 1_015.13);
  }
  if (x <= 277_825) return Math.floor(0.42 * x - 10_911.92);
  return Math.floor(0.45 * x - 19_246.67);
}

const RULES: Record<TaxCountry, Rule> = {
  // Russia: personal income tax (NDFL), progressive since 2025. Insurance contributions are paid by the employer.
  RU: {
    currency: "RUB",
    year: 2025,
    annual: (g) => [
      {
        key: "ndfl",
        amount: progressive(g, [
          { upTo: 2_400_000, rate: 0.13 },
          { upTo: 5_000_000, rate: 0.15 },
          { upTo: 20_000_000, rate: 0.18 },
          { upTo: 50_000_000, rate: 0.2 },
          { upTo: Infinity, rate: 0.22 },
        ]),
      },
    ],
  },
  // United States: federal income tax (single, standard deduction) + Social Security + Medicare. No state tax.
  US: {
    currency: "USD",
    year: 2025,
    annual: (g) => [
      { key: "federalIncome", amount: progressive(Math.max(g - 15_750, 0), US_BRACKETS) },
      { key: "socialSecurity", amount: Math.min(g, 176_100) * 0.062 },
      { key: "medicare", amount: g * 0.0145 + Math.max(g - 200_000, 0) * 0.009 },
    ],
  },
  // Germany: employee social contributions + income tax, tax class I, no church tax, no solidarity surcharge.
  DE: {
    currency: "EUR",
    year: 2025,
    annual: (g) => {
      const pension = Math.min(g, 96_600) * 0.093;
      const unemployment = Math.min(g, 96_600) * 0.013;
      const health = Math.min(g, 66_150) * (0.073 + 0.0125); // general rate + half of the average extra contribution
      const care = Math.min(g, 66_150) * 0.018;
      const zve = Math.max(g - (pension + unemployment + health + care) - 1_230 - 36, 0);
      return [
        { key: "pension", amount: pension },
        { key: "unemployment", amount: unemployment },
        { key: "health", amount: health },
        { key: "care", amount: care },
        { key: "incomeTax", amount: germanIncomeTax(zve) },
      ];
    },
  },
  // Spain: employee Social Security (6.48%, capped) + IRPF (state and regional scales combined, general average).
  ES: {
    currency: "EUR",
    year: 2025,
    annual: (g) => {
      const socialSecurity = Math.min(g, 58_914) * 0.0648;
      const taxable = Math.max(g - socialSecurity - 2_000, 0);
      const scale = (x: number) =>
        progressive(x, [
          { upTo: 12_450, rate: 0.19 },
          { upTo: 20_200, rate: 0.24 },
          { upTo: 35_200, rate: 0.3 },
          { upTo: 60_000, rate: 0.37 },
          { upTo: 300_000, rate: 0.45 },
          { upTo: Infinity, rate: 0.47 },
        ]);
      // The personal minimum (5 550) is taxed at the lowest rates and taken off.
      return [
        { key: "socialSecurity", amount: socialSecurity },
        { key: "incomeTax", amount: Math.max(scale(taxable) - scale(5_550), 0) },
      ];
    },
  },
  // France: employee contributions (about 22% of gross, CSG/CRDS included) + income tax, one tax share, with the 10% allowance and the decote.
  FR: {
    currency: "EUR",
    year: 2025,
    annual: (g) => {
      const contributions = g * 0.22;
      const net = g - contributions;
      const allowance = Math.min(Math.max(net * 0.1, 495), 14_171);
      const taxable = Math.max(net - allowance, 0);
      let tax = progressive(taxable, [
        { upTo: 11_497, rate: 0 },
        { upTo: 29_315, rate: 0.11 },
        { upTo: 83_823, rate: 0.3 },
        { upTo: 180_294, rate: 0.41 },
        { upTo: Infinity, rate: 0.45 },
      ]);
      if (tax < 1_964) tax = Math.max(tax - Math.max(889 - 0.4525 * tax, 0), 0);
      return [
        { key: "socialContributions", amount: contributions },
        { key: "incomeTax", amount: tax },
      ];
    },
  },
  // Japan: health insurance, pension and employment insurance + national income tax (with the 2.1% surtax) + resident tax.
  JP: {
    currency: "JPY",
    year: 2025,
    annual: (g) => {
      const monthly = g / 12;
      const health = Math.min(monthly, 1_390_000) * 12 * 0.0499;
      const pension = Math.min(monthly, 650_000) * 12 * 0.0915;
      const unemployment = g * 0.0055;
      const social = health + pension + unemployment;
      const employmentDeduction =
        g <= 1_900_000
          ? 650_000
          : g <= 3_600_000
            ? g * 0.3 + 80_000
            : g <= 6_600_000
              ? g * 0.2 + 440_000
              : g <= 8_500_000
                ? g * 0.1 + 1_100_000
                : 1_950_000;
      const income = Math.max(g - employmentDeduction - social, 0);
      const national =
        progressive(Math.max(income - 480_000, 0), [
          { upTo: 1_950_000, rate: 0.05 },
          { upTo: 3_300_000, rate: 0.1 },
          { upTo: 6_950_000, rate: 0.2 },
          { upTo: 9_000_000, rate: 0.23 },
          { upTo: 18_000_000, rate: 0.33 },
          { upTo: 40_000_000, rate: 0.4 },
          { upTo: Infinity, rate: 0.45 },
        ]) * 1.021;
      return [
        { key: "health", amount: health },
        { key: "pension", amount: pension },
        { key: "unemployment", amount: unemployment },
        { key: "incomeTax", amount: national },
        { key: "residentTax", amount: Math.max(income - 430_000, 0) * 0.1 },
      ];
    },
  },
  // South Korea: pension, health, long-term care and employment insurance + income tax (after credits) + 10% local tax.
  KR: {
    currency: "KRW",
    year: 2025,
    annual: (g) => {
      const pension = Math.min(g / 12, 6_170_000) * 12 * 0.045;
      const health = g * 0.03545;
      const care = health * 0.1295;
      const unemployment = g * 0.009;
      const employmentDeduction =
        g <= 5_000_000
          ? g * 0.7
          : g <= 15_000_000
            ? 3_500_000 + (g - 5_000_000) * 0.4
            : g <= 45_000_000
              ? 7_500_000 + (g - 15_000_000) * 0.15
              : g <= 100_000_000
                ? 12_000_000 + (g - 45_000_000) * 0.05
                : Math.min(14_750_000 + (g - 100_000_000) * 0.02, 20_000_000);
      const base = Math.max(g - employmentDeduction - 1_500_000 - pension - health - care - unemployment, 0);
      const tax = progressive(base, [
        { upTo: 14_000_000, rate: 0.06 },
        { upTo: 50_000_000, rate: 0.15 },
        { upTo: 88_000_000, rate: 0.24 },
        { upTo: 150_000_000, rate: 0.35 },
        { upTo: 300_000_000, rate: 0.38 },
        { upTo: 500_000_000, rate: 0.4 },
        { upTo: 1_000_000_000, rate: 0.42 },
        { upTo: Infinity, rate: 0.45 },
      ]);
      const credit = Math.min(
        tax <= 1_300_000 ? tax * 0.55 : 715_000 + (tax - 1_300_000) * 0.3,
        g <= 33_000_000
          ? 740_000
          : g <= 70_000_000
            ? Math.max(740_000 - (g - 33_000_000) * 0.008, 660_000)
            : g <= 120_000_000
              ? 500_000
              : 200_000,
      );
      const incomeTax = Math.max(tax - credit, 0);
      return [
        { key: "pension", amount: pension },
        { key: "health", amount: health },
        { key: "care", amount: care },
        { key: "unemployment", amount: unemployment },
        { key: "incomeTax", amount: incomeTax },
        { key: "residentTax", amount: incomeTax * 0.1 },
      ];
    },
  },
  // Turkey: SGK (14%) and unemployment (1%) contributions, capped + income tax and stamp tax, less the minimum-wage exemption.
  TR: {
    currency: "TRY",
    year: 2025,
    annual: (g) => {
      const capped = Math.min(g / 12, 150_018.9) * 12;
      const sgk = capped * 0.14;
      const unemployment = capped * 0.01;
      const tax = progressive(Math.max(g - sgk - unemployment, 0), [
        { upTo: 158_000, rate: 0.15 },
        { upTo: 330_000, rate: 0.2 },
        { upTo: 800_000, rate: 0.27 },
        { upTo: 4_300_000, rate: 0.34 },
        { upTo: Infinity, rate: 0.4 },
      ]);
      return [
        { key: "socialSecurity", amount: sgk },
        { key: "unemployment", amount: unemployment },
        { key: "incomeTax", amount: Math.max(tax - 3_315.7 * 12, 0) },
        { key: "stampTax", amount: Math.max(g * 0.00759 - 197.38 * 12, 0) },
      ];
    },
  },
  // China: pension, medical and unemployment insurance (housing fund not included) + comprehensive income tax.
  CN: {
    currency: "CNY",
    year: 2025,
    annual: (g) => {
      const capped = Math.min(g / 12, 31_884) * 12;
      const pension = capped * 0.08;
      const health = capped * 0.02;
      const unemployment = capped * 0.005;
      const taxable = Math.max(g - 60_000 - pension - health - unemployment, 0);
      return [
        { key: "pension", amount: pension },
        { key: "health", amount: health },
        { key: "unemployment", amount: unemployment },
        {
          key: "incomeTax",
          amount: progressive(taxable, [
            { upTo: 36_000, rate: 0.03 },
            { upTo: 144_000, rate: 0.1 },
            { upTo: 300_000, rate: 0.2 },
            { upTo: 420_000, rate: 0.25 },
            { upTo: 660_000, rate: 0.3 },
            { upTo: 960_000, rate: 0.35 },
            { upTo: Infinity, rate: 0.45 },
          ]),
        },
      ];
    },
  },
  // Uzbekistan: flat 12% personal income tax + 0.1% pension (INPS) contribution. The 12% social tax is paid by the employer.
  UZ: {
    currency: "UZS",
    year: 2025,
    annual: (g) => [
      { key: "incomeTax", amount: g * 0.12 },
      { key: "pension", amount: g * 0.001 },
    ],
  },
};

/** Currency the rules of a country are written in. */
export function taxCurrency(country: TaxCountry): string {
  return RULES[country].currency;
}

/** Tax year of the rates used for a country. */
export function taxYear(country: TaxCountry): number {
  return RULES[country].year;
}

/**
 * Monthly taxes for a monthly gross pay (minor units of `currency`).
 * Returns null when `currency` is not the country's own currency: the thresholds are in that currency.
 * Lines that come to nothing are left out.
 */
export function computeTaxes(country: TaxCountry, monthlyGross: number, currency: string): TaxLine[] | null {
  const rule = RULES[country];
  if (currency !== rule.currency || monthlyGross <= 0) return currency === rule.currency ? [] : null;
  const scale = 10 ** minorDigits(currency);
  const annualGross = (monthlyGross / scale) * 12;
  return rule
    .annual(annualGross)
    .map((l) => ({ key: l.key, amount: Math.round(((l.amount / 12) * scale) + 1e-9) }))
    .filter((l) => l.amount > 0);
}

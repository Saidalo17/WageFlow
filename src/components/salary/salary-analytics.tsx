import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Card } from "@/components/card";
import { SalaryChart } from "@/components/charts/lazy";
import type { SalaryPoint } from "@/components/charts/salary-chart";
import { formatDate } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import {
  buildSeries,
  compareWithPreviousMonth,
  forecast,
  growth,
  monthKeys,
  yearStats,
  type Change,
  type MonthTotals,
} from "@/lib/salary-stats";
import { cn } from "@/lib/utils";

export const CHART_MONTHS = [6, 12] as const;
export type ChartMonths = (typeof CHART_MONTHS)[number];

export async function SalaryAnalytics({
  currency,
  months,
  totals,
  now = new Date(),
}: {
  currency: string;
  months: ChartMonths;
  totals: MonthTotals[];
  now?: Date;
}) {
  const [t, locale] = await Promise.all([getTranslations("salary"), getLocale()]);
  const money = (minor: number) => formatMoney(minor, currency, locale);
  const percent = new Intl.NumberFormat(locale, {
    style: "percent",
    maximumFractionDigits: 1,
    signDisplay: "exceptZero",
  });
  const monthName = (key: string) => formatDate(`${key}-01`, locale, { month: "long", year: "numeric" });

  const series = buildSeries(totals, monthKeys(months, now));
  const hasData = series.some((r) => r.count > 0);
  const compare = compareWithPreviousMonth(totals, now);
  const year = yearStats(totals, now);
  const grow = growth(totals, now);
  const fc = forecast(totals, now);

  const points: SalaryPoint[] = [
    ...series.map((r) => ({ month: r.month, gross: r.gross, net: r.net })),
    ...(fc ? fc.months.map((f) => ({ month: f.month, gross: 0, net: 0, forecast: f.net })) : []),
  ];

  /** A change as colored text with an arrow, so it never relies on color alone. */
  const changeText = (value: Change) => {
    if (value === null) return <span className="text-muted-foreground">{t("analytics.noComparison")}</span>;
    const up = value > 0;
    const down = value < 0;
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 font-semibold",
          up && "text-income",
          down && "text-expense",
          !up && !down && "text-muted-foreground",
        )}
      >
        {up && <ArrowUpRight className="size-4" />}
        {down && <ArrowDownRight className="size-4" />}
        {!up && !down && <Minus className="size-4" />}
        {percent.format(value)}
      </span>
    );
  };

  const stat = (label: string, value: string) => (
    <div className="flex items-baseline justify-between gap-3 py-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="amount text-right font-semibold">{value}</dd>
    </div>
  );

  const chip = (active: boolean) =>
    cn(
      "inline-flex h-9 items-center rounded-full border px-4 text-sm font-semibold transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
      active
        ? "border-transparent bg-accent text-accent-foreground"
        : "bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
    );

  const trend = fc
    ? fc.slope > 0
      ? t("analytics.trendUp", { amount: money(fc.slope) })
      : fc.slope < 0
        ? t("analytics.trendDown", { amount: money(-fc.slope) })
        : t("analytics.trendFlat")
    : null;

  return (
    <>
      {/* This month against the previous one */}
      <Card title={t("analytics.compareTitle")} index={2}>
        <div className="grid gap-4 sm:grid-cols-3">
          {(
            [
              ["net", t("net"), compare.current.net, compare.net],
              ["gross", t("gross"), compare.current.gross, compare.gross],
              ["bonus", t("bonusTotal"), compare.current.bonus, compare.bonus],
            ] as const
          ).map(([key, label, value, change]) => (
            <div key={key} className="space-y-1 rounded-2xl bg-muted p-4">
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="amount text-2xl font-extrabold">{money(value)}</p>
              <p className="text-sm">
                {changeText(change)}
                {change !== null && <span className="text-muted-foreground"> {t("analytics.vsLast")}</span>}
              </p>
            </div>
          ))}
        </div>
      </Card>

      {/* Chart: 6 or 12 months, plus the forecast */}
      <Card
        title={t("analytics.chartTitle")}
        index={3}
        action={
          <div className="flex gap-2" role="group" aria-label={t("analytics.period")}>
            {CHART_MONTHS.map((m) => (
              <Link
                key={m}
                href={m === 6 ? "/salary" : `/salary?months=${m}`}
                scroll={false}
                aria-current={m === months ? "true" : undefined}
                className={chip(m === months)}
              >
                {t("analytics.months", { count: m })}
              </Link>
            ))}
          </div>
        }
      >
        {hasData ? (
          <>
            <SalaryChart
              data={points}
              currency={currency}
              labels={{ gross: t("gross"), net: t("net"), forecast: t("analytics.legendForecast") }}
              ariaLabel={t("analytics.chartAria")}
            />
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm font-medium">
              <span className="flex items-center gap-2">
                <span className="size-3 rounded-full bg-muted-foreground opacity-50" aria-hidden />
                {t("gross")}
              </span>
              <span className="flex items-center gap-2">
                <span className="size-3 rounded-full bg-income" aria-hidden />
                {t("net")}
              </span>
              {fc && (
                <span className="flex items-center gap-2">
                  <span className="size-3 rounded-full border border-dashed border-income bg-income/30" aria-hidden />
                  {t("analytics.legendForecast")}
                </span>
              )}
            </div>
          </>
        ) : (
          <p className="grid h-[200px] place-items-center text-center text-muted-foreground">{t("analytics.noData")}</p>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Year statistics */}
        <Card title={t("analytics.yearTitle")} index={4}>
          <dl className="divide-y">
            {stat(t("net"), money(year.net))}
            {stat(t("gross"), money(year.gross))}
            {stat(t("bonusTotal"), money(year.bonus))}
            {stat(t("overtimePay"), money(year.overtime))}
            {stat(t("deductions"), money(year.deductions))}
            {stat(t("analytics.deductionShare"), percent.format(year.deductionRate).replace(/^\+/, ""))}
            {stat(t("analytics.averageNet"), money(year.averageNet))}
            {year.best && stat(t("analytics.bestMonth"), `${monthName(year.best.month)} · ${money(year.best.net)}`)}
          </dl>
          <p className="mt-3 text-xs text-muted-foreground">{t("analytics.paidMonths", { count: year.monthsWithPay })}</p>
        </Card>

        {/* Growth */}
        <Card title={t("analytics.growthTitle")} index={5}>
          <dl className="space-y-4">
            {(
              [
                [t("analytics.growthRecent"), grow.recent],
                [t("analytics.growthYear"), grow.yearly],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="space-y-1">
                <dt className="text-sm text-muted-foreground">{label}</dt>
                <dd className="text-2xl font-extrabold">
                  {value === null ? (
                    <span className="text-base font-medium text-muted-foreground">{t("analytics.growthNone")}</span>
                  ) : (
                    changeText(value)
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </Card>

        {/* Forecast */}
        <Card title={t("analytics.forecastTitle")} index={6}>
          {fc ? (
            <>
              <dl className="divide-y">
                {stat(t("analytics.forecastNext"), money(fc.months[0].net))}
                {stat(t("analytics.forecastThree"), money(fc.months.reduce((s, m) => s + m.net, 0)))}
                {stat(t("analytics.forecastYear"), money(fc.yearEstimate))}
              </dl>
              <p className="mt-3 text-sm font-medium">{trend}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("analytics.basedOn", { count: fc.basedOn })} · {t("analytics.forecastNote")}
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{t("analytics.forecastNeed")}</p>
          )}
        </Card>
      </div>
    </>
  );
}

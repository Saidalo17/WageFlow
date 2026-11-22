import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Card } from "@/components/card";
import { PayPlanner } from "@/components/salary/pay-planner";
import { SalaryAnalytics, type ChartMonths } from "@/components/salary/salary-analytics";
import { SalaryCalculator } from "@/components/salary/salary-calculator";
import { SalaryHistory } from "@/components/salary/salary-history";
import { SalaryReportLinks } from "@/components/salary/salary-report-links";
import { formatMoney } from "@/lib/money";
import { currentPeriod, percentChange, rangeBounds } from "@/lib/period";
import { monthKeys } from "@/lib/salary-stats";
import { listSalaryRecords, salaryMonthlyTotals } from "@/lib/services/salary";
import { listSchedules } from "@/lib/services/schedules";
import { getCurrentUser } from "@/lib/session";
import { cn } from "@/lib/utils";

export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("salary") };
}

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function SalaryPage({ searchParams }: PageProps<"/salary">) {
  const user = await getCurrentUser();
  const sp = await searchParams;
  const months: ChartMonths = first(sp.months) === "12" ? 12 : 6;
  const now = new Date();
  const [t, locale, records, totals, schedules] = await Promise.all([
    getTranslations("salary"),
    getLocale(),
    listSalaryRecords(user.id),
    // 24 months back: enough for the chart, the year summary and the comparison with the year before.
    salaryMonthlyTotals(user.id, user.currency, monthKeys(24, now)[0]),
    listSchedules(user.id),
  ]);
  // The latest saved net pay in the main currency: a good first guess for what the next payment will be.
  const suggestedNet = records.find((r) => r.currency === user.currency)?.net ?? null;

  // Totals for the current and the previous period. Only records in the user's main currency are added up.
  const period = currentPeriod(user.monthStartDay);
  const prev = rangeBounds("prev", user.monthStartDay) as { from: string; to: string };
  const sum = (range: { from: string; to: string }, key: "gross" | "net") =>
    records
      .filter((r) => r.currency === user.currency && r.payDate >= range.from && r.payDate <= range.to)
      .reduce((s, r) => s + r[key], 0);

  const cards = (["gross", "net"] as const).map((key) => {
    const current = sum(period, key);
    const previous = sum(prev, key);
    return { key, current, change: percentChange(current, previous), hasPrev: previous > 0 };
  });
  const percent = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0, signDisplay: "exceptZero" });

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-[28px] font-extrabold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {cards.map(({ key, current, change, hasPrev }, i) => (
          <Card key={key} title={t(key === "gross" ? "periodGross" : "periodNet")} index={i}>
            <p className="amount text-3xl font-extrabold">{formatMoney(current, user.currency, locale)}</p>
            <p
              className={cn(
                "mt-1 inline-flex items-center gap-1 text-sm font-semibold",
                change === null || change === 0 ? "text-muted-foreground" : change > 0 ? "text-income" : "text-expense",
              )}
            >
              {change !== null && change > 0 && <ArrowUpRight className="size-4" />}
              {change !== null && change < 0 && <ArrowDownRight className="size-4" />}
              {hasPrev && change !== null ? t("vsPrevious", { change: percent.format(change) }) : t("noPrevious")}
            </p>
          </Card>
        ))}
      </div>

      <SalaryCalculator currency={user.currency} defaultCountry={user.country} />
      <SalaryAnalytics currency={user.currency} months={months} totals={totals} now={now} />
      <PayPlanner schedules={schedules} currency={user.currency} suggestedNet={suggestedNet} />
      <SalaryReportLinks years={[...new Set(totals.map((m) => Number(m.month.slice(0, 4))))].sort((a, b) => b - a)} />
      <SalaryHistory records={records} />
    </div>
  );
}

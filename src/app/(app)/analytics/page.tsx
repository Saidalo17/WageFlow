import { ArrowDownLeft, ArrowUpRight, Minus, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { RangePicker } from "@/components/analytics/range-picker";
import { Card } from "@/components/card";
import { AreaChart } from "@/components/charts/area-chart";
import { BarChart } from "@/components/charts/bar-chart";
import { DonutChart } from "@/components/charts/donut-chart";
import { formatDate } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import {
  analyticsBounds,
  capAtTomorrow,
  comparisonBounds,
  daysBetween,
  isAnalyticsRange,
  lastMonths,
  parseCustomRange,
  percentChange,
  type AnalyticsRange,
} from "@/lib/period";
import { incomeExpenseSeries, totalsByCategory } from "@/lib/services/analytics";
import { sumTransactions } from "@/lib/services/transactions";
import { getCurrentUser } from "@/lib/session";
import { cn } from "@/lib/utils";

export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("analytics") };
}

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

type Change = number | "new" | undefined;

/** A percentage, "new" when the previous period had nothing, or undefined when both are empty. */
function changeOf(current: number, previous: number): Change {
  const pct = percentChange(current, previous);
  if (pct !== null) return pct;
  return current === 0 ? undefined : "new";
}

export default async function AnalyticsPage({ searchParams }: PageProps<"/analytics">) {
  const user = await getCurrentUser();
  const [t, tSys, locale, sp] = await Promise.all([
    getTranslations("analytics"),
    getTranslations("categories.system"),
    getLocale(),
    searchParams,
  ]);

  // --- Which period? (all values come from the URL, so they are validated) ---
  const rawRange = first(sp.range);
  let range: AnalyticsRange = isAnalyticsRange(rawRange) ? rawRange : "month";
  const custom = parseCustomRange(first(sp.from), first(sp.to));
  const invalidCustom = range === "custom" && !custom;
  if (invalidCustom) range = "month";

  const bounds = analyticsBounds(range, user.monthStartDay, custom);
  const compare = comparisonBounds(range, bounds, user.monthStartDay);
  const granularity = daysBetween(bounds.from, bounds.to) > 92 ? "month" : "day";
  const months = first(sp.months) === "12" ? 12 : 6;
  const monthly = lastMonths(months);

  const [cur, prev, series, byCategory, prevByCategory, monthlySeries] = await Promise.all([
    sumTransactions(user.id, bounds),
    sumTransactions(user.id, compare),
    incomeExpenseSeries(user.id, bounds.from, capAtTomorrow(bounds.to), granularity),
    totalsByCategory(user.id, "expense", bounds.from, bounds.to),
    totalsByCategory(user.id, "expense", compare.from, compare.to),
    incomeExpenseSeries(user.id, monthly.from, monthly.to, "month"),
  ]);

  const money = (minor: number) => formatMoney(minor, user.currency, locale);
  const curBalance = cur.income - cur.expense;
  const prevBalance = prev.income - prev.expense;
  const hasData = series.some((p) => p.income > 0 || p.expense > 0);
  const hasMonthly = monthlySeries.some((p) => p.income > 0 || p.expense > 0);

  const dateRange = (r: { from: string; to: string }) =>
    `${formatDate(r.from, locale, { day: "numeric", month: "short", year: "numeric" })} – ${formatDate(r.to, locale, { day: "numeric", month: "short", year: "numeric" })}`;

  const prevAmounts = new Map(prevByCategory.map((c) => [c.categoryId, c.total]));
  const totalExpense = cur.expense;
  const topRows = byCategory.slice(0, 8).map((c) => ({
    id: c.categoryId,
    name: c.systemKey ? tSys(c.systemKey) : c.name,
    color: c.color,
    total: c.total,
    share: totalExpense ? c.total / totalExpense : 0,
    change: changeOf(c.total, prevAmounts.get(c.categoryId) ?? 0),
  }));

  const pct = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1, signDisplay: "exceptZero" });
  const pctPlain = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 });

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-[28px] font-extrabold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{dateRange(bounds)}</p>
      </div>

      <RangePicker
        key={`${range}-${bounds.from}-${bounds.to}`}
        range={range}
        from={bounds.from}
        to={bounds.to}
        invalid={invalidCustom}
      />

      {/* Totals with a comparison to the previous period */}
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          label={t("income")}
          value={`${cur.income > 0 ? "+" : ""}${money(cur.income)}`}
          tone="income"
          icon={<ArrowUpRight className="size-5" />}
          change={changeOf(cur.income, prev.income)}
          upIsGood
          pct={pct}
          t={t}
        />
        <MetricCard
          label={t("expenses")}
          value={`${cur.expense > 0 ? "−" : ""}${money(cur.expense)}`}
          tone="expense"
          icon={<ArrowDownLeft className="size-5" />}
          change={changeOf(cur.expense, prev.expense)}
          upIsGood={false}
          pct={pct}
          t={t}
        />
        <MetricCard
          label={t("balance")}
          value={`${curBalance > 0 ? "+" : curBalance < 0 ? "−" : ""}${money(Math.abs(curBalance))}`}
          tone="neutral"
          icon={<Wallet className="size-5" />}
          change={prevBalance === 0 ? (curBalance === 0 ? undefined : "new") : (curBalance - prevBalance) / Math.abs(prevBalance)}
          upIsGood
          pct={pct}
          t={t}
        />
      </div>
      <p className="-mt-3 text-sm text-muted-foreground">{t("comparedWith", { range: dateRange(compare) })}</p>

      {/* Dynamics + structure */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title={t("dynamicsTitle")} className="lg:col-span-2">
          {hasData ? (
            <>
              <AreaChart
                data={series}
                currency={user.currency}
                granularity={granularity}
                labels={{ income: t("income"), expense: t("expenses") }}
                ariaLabel={t("dynamicsAria")}
                height={300}
              />
              <Legend income={t("income")} expense={t("expenses")} />
            </>
          ) : (
            <Empty text={t("noData")} />
          )}
        </Card>

        <Card title={t("structureTitle")}>
          {byCategory.length > 0 ? (
            <DonutChart data={byCategory} currency={user.currency} ariaLabel={t("structureAria")} />
          ) : (
            <Empty text={t("noData")} />
          )}
        </Card>
      </div>

      {/* Months + top categories */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card
          title={t("monthsTitle")}
          className="lg:col-span-2"
          action={
            <div className="flex gap-1 rounded-full bg-muted p-1" role="group" aria-label={t("monthsCount")}>
              {([6, 12] as const).map((n) => (
                <Link
                  key={n}
                  href={n === 6 ? `/analytics${qs(sp, { months: null })}` : `/analytics${qs(sp, { months: "12" })}`}
                  scroll={false}
                  aria-current={months === n ? "true" : undefined}
                  className={cn(
                    "rounded-full px-3 py-1 text-sm font-semibold transition-colors",
                    months === n ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t("monthsN", { n })}
                </Link>
              ))}
            </div>
          }
        >
          {hasMonthly ? (
            <>
              <BarChart
                data={monthlySeries}
                currency={user.currency}
                labels={{ income: t("income"), expense: t("expenses") }}
                ariaLabel={t("monthsAria")}
              />
              <Legend income={t("income")} expense={t("expenses")} />
            </>
          ) : (
            <Empty text={t("noData")} />
          )}
        </Card>

        <Card title={t("topTitle")}>
          {topRows.length > 0 ? (
            <table className="w-full text-sm">
              <caption className="sr-only">{t("topCaption")}</caption>
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th scope="col" className="pb-2 font-semibold">
                    {t("colCategory")}
                  </th>
                  <th scope="col" className="pb-2 text-right font-semibold">
                    {t("colAmount")}
                  </th>
                  <th scope="col" className="pb-2 text-right font-semibold">
                    {t("colChange")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {topRows.map((r) => (
                  <tr key={r.id}>
                    <td className="py-2.5 pr-2">
                      <span className="flex items-center gap-2">
                        <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: r.color }} aria-hidden />
                        <span className="truncate font-semibold">{r.name}</span>
                      </span>
                      <span className="amount ml-[18px] text-xs text-muted-foreground">{pctPlain.format(r.share)}</span>
                    </td>
                    <td className="amount py-2.5 text-right font-bold whitespace-nowrap">{money(r.total)}</td>
                    <td className="py-2.5 pl-2 text-right whitespace-nowrap">
                      <ChangeBadge value={r.change} upIsGood={false} pct={pct} newLabel={t("new")} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <Empty text={t("noData")} />
          )}
        </Card>
      </div>
    </div>
  );
}

/** Keeps the other URL parameters while one of them changes. */
function qs(
  sp: Record<string, string | string[] | undefined>,
  changes: Record<string, string | null>,
) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    const value = Array.isArray(v) ? v[0] : v;
    if (value !== undefined) params.set(k, value);
  }
  for (const [k, v] of Object.entries(changes)) {
    if (v === null) params.delete(k);
    else params.set(k, v);
  }
  const s = params.toString();
  return s ? `?${s}` : "";
}

function Empty({ text }: { text: string }) {
  return <p className="grid h-[240px] place-items-center text-muted-foreground">{text}</p>;
}

function Legend({ income, expense }: { income: string; expense: string }) {
  return (
    <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm font-medium">
      <span className="flex items-center gap-2">
        <span className="size-3 rounded-full bg-income" aria-hidden />
        {income}
      </span>
      <span className="flex items-center gap-2">
        <span className="size-3 rounded-full bg-expense" aria-hidden />
        {expense}
      </span>
    </div>
  );
}

/** Change versus the previous period. Always shown with an arrow and a sign, never by color alone. */
function ChangeBadge({
  value,
  upIsGood,
  pct,
  newLabel,
}: {
  value: Change;
  upIsGood: boolean;
  pct: Intl.NumberFormat;
  newLabel: string;
}) {
  if (value === undefined) return null;
  if (value === "new") {
    return <span className="text-xs font-semibold text-muted-foreground">{newLabel}</span>;
  }
  if (Math.abs(value) < 0.0005) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground">
        <Minus className="size-3.5" />0 %
      </span>
    );
  }
  const up = value > 0;
  const good = up === upIsGood;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span
      className={cn(
        "amount inline-flex items-center gap-1 text-xs font-bold",
        good ? "text-income" : "text-expense",
      )}
    >
      <Icon className="size-3.5" />
      {pct.format(value)}
    </span>
  );
}

function MetricCard({
  label,
  value,
  tone,
  icon,
  change,
  upIsGood,
  pct,
  t,
}: {
  label: string;
  value: string;
  tone: "income" | "expense" | "neutral";
  icon: React.ReactNode;
  change: Change;
  upIsGood: boolean;
  pct: Intl.NumberFormat;
  t: (key: string) => string;
}) {
  return (
    <div className="flex items-center gap-4 rounded-3xl border bg-card p-6 shadow-[var(--shadow-card)]">
      <span
        className={cn(
          "grid size-12 shrink-0 place-items-center rounded-full",
          tone === "income" && "bg-income-bg text-income",
          tone === "expense" && "bg-expense-bg text-expense",
          tone === "neutral" && "bg-accent text-accent-foreground",
        )}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-muted-foreground">{label}</p>
        <p
          className={cn(
            "amount text-2xl font-extrabold break-words",
            tone === "income" && "text-income",
            tone === "expense" && "text-expense",
          )}
        >
          {value}
        </p>
        <ChangeBadge value={change} upIsGood={upIsGood} pct={pct} newLabel={t("new")} />
      </div>
    </div>
  );
}

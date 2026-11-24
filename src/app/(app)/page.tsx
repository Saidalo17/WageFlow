import { intlLocale } from "@/lib/intl-locale";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { AreaChart } from "@/components/charts/lazy";
import { DonutChart } from "@/components/charts/lazy";
import { Card } from "@/components/card";
import { AccountsTile } from "@/components/dashboard/accounts-tile";
import { BudgetRing } from "@/components/dashboard/budget-ring";
import { HeatmapTile } from "@/components/dashboard/heatmap-tile";
import { HeroBalance } from "@/components/dashboard/hero-balance";
import { InsightsTile } from "@/components/dashboard/insights-tile";
import { RangeChips } from "@/components/dashboard/range-chips";
import { StatTile } from "@/components/dashboard/stat-tile";
import { Greeting } from "@/components/overview/greeting";
import { QuickAdd } from "@/components/overview/quick-add";
import { RecentTransactions } from "@/components/overview/recent-transactions";
import { buttonVariants } from "@/components/ui/button";
import { convertBudgets, convertSeries, convertTotals, convertTotalsBy, convertTransactions } from "@/lib/display-convert";
import { getDisplay } from "@/lib/display-currency";
import { formatDate, todayISO } from "@/lib/format";
import { buildHeatmap, heatmapStart } from "@/lib/heatmap";
import { buildInsights } from "@/lib/insights";
import { formatMoney } from "@/lib/money";
import {
  analyticsBounds,
  capAtTomorrow,
  comparisonBounds,
  currentPeriod,
  isAnalyticsRange,
  percentChange,
  type AnalyticsRange,
} from "@/lib/period";
import { listAccounts } from "@/lib/services/accounts";
import { listBudgets } from "@/lib/services/budgets";
import { listCategoriesWithTotals } from "@/lib/services/categories";
import { loadNetWorth } from "@/lib/services/net-worth";
import { touchLastSeen } from "@/lib/services/users";
import { incomeExpenseSeries, totalsByCategory } from "@/lib/services/analytics";
import { listTransactions, sumTransactions } from "@/lib/services/transactions";
import { getCurrentUser } from "@/lib/session";

const OVERVIEW_RANGES = ["week", "month", "prev", "quarter", "year"] as const satisfies readonly AnalyticsRange[];
type OverviewRange = (typeof OVERVIEW_RANGES)[number];
const HEAT_WEEKS = 13;

export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("overview") };
}

export default async function OverviewPage({ searchParams }: PageProps<"/">) {
  const user = await getCurrentUser();
  const [t, tRanges, tSys, locale, sp] = await Promise.all([
    getTranslations("overview"),
    getTranslations("analytics.ranges"),
    getTranslations("categories.system"),
    getLocale(),
    searchParams,
  ]);

  const raw = Array.isArray(sp.range) ? sp.range[0] : sp.range;
  const range: OverviewRange = isAnalyticsRange(raw) && (OVERVIEW_RANGES as readonly string[]).includes(raw) ? (raw as OverviewRange) : "month";
  const bounds = analyticsBounds(range, user.monthStartDay, null);
  const { from, to } = bounds;
  const previous = comparisonBounds(range, bounds, user.monthStartDay);
  const granularity = range === "quarter" || range === "year" ? "month" : "day";
  const today = todayISO();

  const display = await getDisplay(user.currency);
  const [rawTotals, rawPrevious, rawSeries, rawByCategory, rawRecent, rawBudgets, rawCategories, away, heatSeries, accounts, worth] = await Promise.all([
    sumTransactions(user.id, { from, to }),
    sumTransactions(user.id, { from: previous.from, to: previous.to }),
    incomeExpenseSeries(user.id, from, capAtTomorrow(to), granularity),
    totalsByCategory(user.id, "expense", from, to),
    listTransactions(user.id, {}, 5),
    // Limits are monthly, so they always use the current month, whatever period is picked above.
    listBudgets(user.id, currentPeriod(user.monthStartDay)),
    listCategoriesWithTotals(user.id, { from, to }),
    // True when the user has been away for a long time ("Glad you're back").
    touchLastSeen(user.id, user.lastSeenAt),
    incomeExpenseSeries(user.id, heatmapStart(today, HEAT_WEEKS), today, "day"),
    listAccounts(user.id),
    loadNetWorth(user.id, user.currency),
  ]);

  // Amounts are stored in the main currency; show them in the chosen display currency.
  const totals = convertTotals(display, rawTotals);
  const prevTotals = convertTotals(display, rawPrevious);
  const series = convertSeries(display, rawSeries);
  const byCategory = convertTotalsBy(display, rawByCategory);
  const recent = { ...rawRecent, items: convertTransactions(display, rawRecent.items) };
  const budgets = convertBudgets(display, rawBudgets);
  const allCategories = convertTotalsBy(display, rawCategories);
  const heatmap = buildHeatmap(convertSeries(display, heatSeries), today, HEAT_WEEKS);

  const money = (minor: number) => formatMoney(minor, display.currency, locale);
  const percent = new Intl.NumberFormat(intlLocale(locale), { style: "percent", maximumFractionDigits: 1, signDisplay: "exceptZero" });
  const balance = totals.income - totals.expense;
  const previousBalance = prevTotals.income - prevTotals.expense;
  const hasData = series.some((p) => p.income > 0 || p.expense > 0);
  const firstName = user.name?.trim().split(/\s+/)[0];

  // The running balance over the period, for the hero's little chart
  const curve = series.reduce<number[]>((acc, p) => [...acc, (acc[acc.length - 1] ?? 0) + p.income - p.expense], []);
  const incomeChange = percentChange(totals.income, prevTotals.income);
  const expenseChange = percentChange(totals.expense, prevTotals.expense);
  const changeText = (c: number | null) => (c === null ? null : percent.format(c));
  const changeLabel = (c: number | null) => (c === null ? null : t("vsPrevious", { change: percent.format(c) }));

  const insights = buildInsights({
    income: totals.income,
    expense: totals.expense,
    previousExpense: prevTotals.expense,
    categories: byCategory.map((c) => ({ name: c.systemKey ? tSys(c.systemKey) : c.name, total: c.total })),
    budgets: budgets.map((b) => ({ name: b.systemKey ? tSys(b.systemKey) : b.name, spent: b.spent, limit: b.limit })),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <Greeting name={firstName} away={away} />
          <p className="text-muted-foreground">
            {formatDate(from, locale, from.slice(0, 4) === to.slice(0, 4) ? { day: "numeric", month: "long" } : { day: "numeric", month: "long", year: "numeric" })} –{" "}
            {formatDate(to, locale, { day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
        <RangeChips
          ranges={OVERVIEW_RANGES}
          active={range}
          hrefFor={(r) => (r === "month" ? "/" : `/?range=${r}`)}
          labelFor={(r) => tRanges(r)}
          ariaLabel={t("period")}
        />
      </div>

      {/* Bento grid: tiles of different sizes that fall into one column on a phone */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-12">
        <HeroBalance balance={balance} previousBalance={previousBalance} curve={curve} currency={display.currency} locale={locale} className="md:col-span-2 lg:col-span-6" />
        <StatTile
          label={t("income")}
          tone="income"
          value={totals.income}
          change={incomeChange}
          changeText={changeText(incomeChange)}
          changeLabel={changeLabel(incomeChange)}
          bars={series.map((p) => p.income)}
          currency={display.currency}
          index={1}
          className="lg:col-span-3"
        />
        <StatTile
          label={t("expenses")}
          tone="expense"
          value={totals.expense}
          change={expenseChange}
          changeText={changeText(expenseChange)}
          changeLabel={changeLabel(expenseChange)}
          bars={series.map((p) => p.expense)}
          currency={display.currency}
          index={2}
          className="lg:col-span-3"
        />

        <Card title={t("dynamicsTitle")} className="md:col-span-2 lg:col-span-8" index={3}>
          {hasData ? (
            <AreaChart
              data={series}
              currency={display.currency}
              granularity={granularity}
              labels={{ income: t("income"), expense: t("expenses") }}
              ariaLabel={t("dynamicsAria")}
              height={280}
            />
          ) : (
            <p className="grid h-[280px] place-items-center text-muted-foreground">{t("noData")}</p>
          )}
        </Card>

        <AccountsTile
          accounts={accounts}
          netWorth={worth.ok && worth.netWorth.items.length > 0 ? worth.netWorth.netWorth : null}
          netWorthCurrency={user.currency}
          index={4}
          className="lg:col-span-4"
        />

        <Card title={t("structureTitle")} className="lg:col-span-4" index={5}>
          {byCategory.length > 0 ? (
            <DonutChart data={byCategory} currency={display.currency} ariaLabel={t("structureAria")} />
          ) : (
            <p className="grid h-[220px] place-items-center text-muted-foreground">{t("noData")}</p>
          )}
        </Card>

        <BudgetRing
          items={budgets.map((b) => ({ id: b.id, name: b.systemKey ? tSys(b.systemKey) : b.name, color: b.color, spent: b.spent, limit: b.limit }))}
          money={money}
          index={6}
          className="lg:col-span-4"
        />

        <Card
          index={7}
          title={t("recentTitle")}
          className="lg:col-span-4"
          action={
            <Link href="/transactions?range=all" className={buttonVariants({ variant: "ghost", size: "sm" })}>
              {t("viewAll")}
            </Link>
          }
        >
          <RecentTransactions items={recent.items} currency={display.currency} />
        </Card>

        <HeatmapTile heatmap={heatmap} currency={display.currency} index={8} className="md:col-span-2 lg:col-span-8" />
        <InsightsTile insights={insights} currency={display.currency} index={9} className="lg:col-span-4" />

        {/* Categories: tap one to add a transaction by hand */}
        <Card index={10} title={t("quickAdd.title")} className="md:col-span-2 lg:col-span-12">
          <QuickAdd categories={allCategories} currency={display.currency} />
        </Card>
      </div>
    </div>
  );
}

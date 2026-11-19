import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { AreaChart } from "@/components/charts/lazy";
import { DonutChart } from "@/components/charts/lazy";
import { Card } from "@/components/card";
import { BudgetProgress } from "@/components/budgets/budget-progress";
import { CategoryBadge } from "@/components/category-icon";
import { RecentTransactions } from "@/components/overview/recent-transactions";
import { buttonVariants } from "@/components/ui/button";
import { budgetStatus } from "@/lib/budget-status";
import { formatDate } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { capAtTomorrow, currentPeriod, isRange, rangeBounds, type Range } from "@/lib/period";
import { listBudgets } from "@/lib/services/budgets";
import { incomeExpenseSeries, totalsByCategory } from "@/lib/services/analytics";
import { listTransactions, sumTransactions } from "@/lib/services/transactions";
import { getCurrentUser } from "@/lib/session";
import { cn } from "@/lib/utils";

const OVERVIEW_RANGES = ["month", "prev", "quarter", "year"] as const satisfies readonly Range[];

export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("overview") };
}

export default async function OverviewPage({ searchParams }: PageProps<"/">) {
  const user = await getCurrentUser();
  const [t, tRanges, tSys, locale, sp] = await Promise.all([
    getTranslations("overview"),
    getTranslations("transactions.filters.ranges"),
    getTranslations("categories.system"),
    getLocale(),
    searchParams,
  ]);

  const raw = Array.isArray(sp.range) ? sp.range[0] : sp.range;
  const range: (typeof OVERVIEW_RANGES)[number] =
    isRange(raw) && (OVERVIEW_RANGES as readonly string[]).includes(raw)
      ? (raw as (typeof OVERVIEW_RANGES)[number])
      : "month";
  const { from, to } = rangeBounds(range, user.monthStartDay) as { from: string; to: string };
  const granularity = range === "quarter" || range === "year" ? "month" : "day";

  const [totals, series, byCategory, recent, budgets] = await Promise.all([
    sumTransactions(user.id, { from, to }),
    incomeExpenseSeries(user.id, from, capAtTomorrow(to), granularity),
    totalsByCategory(user.id, "expense", from, to),
    listTransactions(user.id, {}, 5),
    // Limits are monthly, so they always use the current month, whatever period is picked above.
    listBudgets(user.id, currentPeriod(user.monthStartDay)),
  ]);

  // The three limits that are closest to being used up.
  const topBudgets = [...budgets]
    .sort((a, b) => b.spent / b.limit - a.spent / a.limit)
    .slice(0, 3);

  const money = (minor: number) => formatMoney(minor, user.currency, locale);
  const balance = totals.income - totals.expense;
  const hasData = series.some((p) => p.income > 0 || p.expense > 0);
  const firstName = user.name?.trim().split(/\s+/)[0];

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-[28px] font-extrabold tracking-tight">
          {firstName ? t("greeting", { name: firstName }) : t("greetingAnon")}
        </h1>
        <p className="text-muted-foreground">
          {formatDate(
            from,
            locale,
            from.slice(0, 4) === to.slice(0, 4)
              ? { day: "numeric", month: "long" }
              : { day: "numeric", month: "long", year: "numeric" },
          )}{" "}
          –{" "}
          {formatDate(to, locale, { day: "numeric", month: "long", year: "numeric" })}
        </p>
      </div>

      {/* Period */}
      <nav className="flex gap-2 overflow-x-auto pb-1" aria-label={t("period")}>
        {OVERVIEW_RANGES.map((r) => (
          <Link
            key={r}
            href={r === "month" ? "/" : `/?range=${r}`}
            scroll={false}
            aria-current={range === r ? "true" : undefined}
            className={cn(
              "h-9 shrink-0 content-center rounded-full border px-4 text-sm font-semibold whitespace-nowrap transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
              range === r
                ? "border-transparent bg-accent text-accent-foreground"
                : "bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {tRanges(r)}
          </Link>
        ))}
      </nav>

      {/* Balance, income, expenses */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div
          className="reveal rounded-3xl bg-gradient-to-br from-[#4f46e5] to-[#7c3aed] p-6 text-white shadow-lg"
          style={{ "--i": 0 } as React.CSSProperties}
        >
          <p className="text-sm font-semibold text-white/80">{t("balance")}</p>
          <p className="amount mt-1 text-[40px] leading-tight font-extrabold break-words">
            {balance > 0 ? "+" : balance < 0 ? "−" : ""}
            {money(Math.abs(balance))}
          </p>
        </div>
        <StatCard
          label={t("income")}
          value={`${totals.income > 0 ? "+" : ""}${money(totals.income)}`}
          tone="income"
          index={1}
          icon={<ArrowUpRight className="size-5" />}
        />
        <StatCard
          label={t("expenses")}
          value={`${totals.expense > 0 ? "−" : ""}${money(totals.expense)}`}
          tone="expense"
          index={2}
          icon={<ArrowDownLeft className="size-5" />}
        />
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title={t("dynamicsTitle")} className="lg:col-span-2" index={3}>
          {hasData ? (
            <>
              <AreaChart
                data={series}
                currency={user.currency}
                granularity={granularity}
                labels={{ income: t("income"), expense: t("expenses") }}
                ariaLabel={t("dynamicsAria")}
              />
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm font-medium">
                <span className="flex items-center gap-2">
                  <span className="size-3 rounded-full bg-income" aria-hidden />
                  {t("income")}
                </span>
                <span className="flex items-center gap-2">
                  <span className="size-3 rounded-full bg-expense" aria-hidden />
                  {t("expenses")}
                </span>
              </div>
            </>
          ) : (
            <p className="grid h-[260px] place-items-center text-muted-foreground">{t("noData")}</p>
          )}
        </Card>

        <Card title={t("structureTitle")} index={4}>
          {byCategory.length > 0 ? (
            <DonutChart data={byCategory} currency={user.currency} ariaLabel={t("structureAria")} />
          ) : (
            <p className="grid h-[260px] place-items-center text-muted-foreground">{t("noData")}</p>
          )}
        </Card>
      </div>

      {/* Limits */}
      <Card
        index={5}
        title={t("budgetsTitle")}
        action={
          <Link href="/budgets" className={buttonVariants({ variant: "ghost", size: "sm" })}>
            {topBudgets.length > 0 ? t("viewBudgets") : t("setLimit")}
          </Link>
        }
      >
        {topBudgets.length === 0 ? (
          <p className="text-muted-foreground">{t("budgetsEmpty")}</p>
        ) : (
          <ul className="space-y-4">
            {topBudgets.map((b) => {
              const ratio = b.limit ? b.spent / b.limit : 0;
              const status = budgetStatus(ratio);
              const name = b.systemKey ? tSys(b.systemKey) : b.name;
              const left = b.limit - b.spent;
              return (
                <li key={b.id} className="space-y-2">
                  <div className="flex items-center gap-3">
                    <CategoryBadge icon={b.icon} color={b.color} className="size-9" />
                    <span className="min-w-0 flex-1 truncate font-bold">{name}</span>
                    <span className="amount text-sm text-muted-foreground">
                      {money(b.spent)} / {money(b.limit)}
                    </span>
                  </div>
                  <BudgetProgress ratio={ratio} label={name} />
                  <p
                    className={cn(
                      "amount text-xs font-semibold",
                      status === "ok" && "text-muted-foreground",
                      status === "warning" && "text-warning",
                      status === "over" && "text-expense",
                    )}
                  >
                    {left >= 0 ? t("budgetLeft", { amount: money(left) }) : t("budgetOver", { amount: money(-left) })}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/* Latest transactions */}
      <Card
        index={6}
        title={t("recentTitle")}
        action={
          <Link href="/transactions?range=all" className={buttonVariants({ variant: "ghost", size: "sm" })}>
            {t("viewAll")}
          </Link>
        }
      >
        <RecentTransactions items={recent.items} currency={user.currency} />
      </Card>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
  icon,
  index,
}: {
  label: string;
  value: string;
  tone: "income" | "expense";
  icon: React.ReactNode;
  index: number;
}) {
  return (
    <div
      className="reveal flex items-center gap-4 rounded-3xl border bg-card p-6 shadow-[var(--shadow-card)]"
      style={{ "--i": index } as React.CSSProperties}
    >
      <span
        className={cn(
          "grid size-12 shrink-0 place-items-center rounded-full",
          tone === "income" ? "bg-income-bg text-income" : "bg-expense-bg text-expense",
        )}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-muted-foreground">{label}</p>
        <p
          className={cn(
            "amount text-2xl font-extrabold break-words",
            tone === "income" ? "text-income" : "text-expense",
          )}
        >
          {value}
        </p>
      </div>
    </div>
  );
}

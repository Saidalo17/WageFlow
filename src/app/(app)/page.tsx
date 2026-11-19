import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { AreaChart } from "@/components/charts/area-chart";
import { DonutChart } from "@/components/charts/donut-chart";
import { Card } from "@/components/card";
import { RecentTransactions } from "@/components/overview/recent-transactions";
import { buttonVariants } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { capAtTomorrow, isRange, rangeBounds, type Range } from "@/lib/period";
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
  const [t, tRanges, locale, sp] = await Promise.all([
    getTranslations("overview"),
    getTranslations("transactions.filters.ranges"),
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

  const [totals, series, byCategory, recent] = await Promise.all([
    sumTransactions(user.id, { from, to }),
    incomeExpenseSeries(user.id, from, capAtTomorrow(to), granularity),
    totalsByCategory(user.id, "expense", from, to),
    listTransactions(user.id, {}, 5),
  ]);

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
        <div className="rounded-3xl bg-gradient-to-br from-brand-600 to-violet-500 p-6 text-white shadow-lg">
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
          icon={<ArrowUpRight className="size-5" />}
        />
        <StatCard
          label={t("expenses")}
          value={`${totals.expense > 0 ? "−" : ""}${money(totals.expense)}`}
          tone="expense"
          icon={<ArrowDownLeft className="size-5" />}
        />
      </div>

      {/* Charts */}
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

        <Card title={t("structureTitle")}>
          {byCategory.length > 0 ? (
            <DonutChart data={byCategory} currency={user.currency} ariaLabel={t("structureAria")} />
          ) : (
            <p className="grid h-[260px] place-items-center text-muted-foreground">{t("noData")}</p>
          )}
        </Card>
      </div>

      {/* Latest transactions */}
      <Card
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
}: {
  label: string;
  value: string;
  tone: "income" | "expense";
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-4 rounded-3xl border bg-card p-6 shadow-[var(--shadow-card)]">
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

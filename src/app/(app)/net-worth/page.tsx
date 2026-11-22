import { ArrowDownRight, ArrowUpRight, Landmark, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Card } from "@/components/card";
import { NetWorthChart } from "@/components/charts/lazy";
import { FinanceTabs } from "@/components/finance/finance-tabs";
import { SnapshotRecorder } from "@/components/finance/snapshot-recorder";
import { buttonVariants } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { sortItems, trend } from "@/lib/net-worth";
import { listSnapshots, loadNetWorth } from "@/lib/services/net-worth";
import { getCurrentUser } from "@/lib/session";
import { cn } from "@/lib/utils";

export async function generateMetadata() {
  const t = await getTranslations("netWorth");
  return { title: t("title") };
}

export default async function NetWorthPage() {
  const user = await getCurrentUser();
  const [t, tAcc, tDebt, locale, result, snapshots] = await Promise.all([
    getTranslations("netWorth"),
    getTranslations("accounts"),
    getTranslations("debts"),
    getLocale(),
    loadNetWorth(user.id, user.currency),
    listSnapshots(user.id, user.currency),
  ]);
  const money = (minor: number, cur = user.currency) => formatMoney(minor, cur, locale);
  const change = trend(snapshots);
  const percent = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1, signDisplay: "exceptZero" });

  return (
    <div className="space-y-6">
      <FinanceTabs />
      <SnapshotRecorder lastDate={snapshots[snapshots.length - 1]?.date ?? null} />

      <div className="space-y-1">
        <h1 className="text-[28px] font-extrabold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle", { currency: user.currency })}</p>
      </div>

      {!result.ok ? (
        <p role="alert" className="flex items-start gap-2 rounded-2xl bg-expense-bg px-4 py-3 text-sm font-medium text-expense">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          {t("ratesUnavailable")}
        </p>
      ) : result.netWorth.items.length === 0 ? (
        <div className="grid place-items-center gap-3 rounded-3xl border border-dashed bg-card px-6 py-14 text-center">
          <span className="grid size-14 place-items-center rounded-full bg-accent text-accent-foreground">
            <Landmark className="size-6" />
          </span>
          <div className="space-y-1">
            <p className="text-lg font-bold">{t("emptyTitle")}</p>
            <p className="max-w-md text-muted-foreground">{t("emptyHint")}</p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <Link href="/accounts" className={buttonVariants()}>
              {t("addAccounts")}
            </Link>
            <Link href="/debts" className={buttonVariants({ variant: "secondary" })}>
              {t("addDebts")}
            </Link>
          </div>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card title={t("assets")} index={0}>
              <p className="amount text-2xl font-extrabold text-income">{money(result.netWorth.assets)}</p>
            </Card>
            <Card title={t("liabilities")} index={1}>
              <p className="amount text-2xl font-extrabold text-expense">{money(result.netWorth.liabilities)}</p>
            </Card>
            <Card title={t("net")} index={2} className="bg-gradient-to-br from-emerald/15 to-gold/15">
              <p className={cn("amount text-3xl font-extrabold", result.netWorth.netWorth < 0 && "text-expense")}>{money(result.netWorth.netWorth)}</p>
              {change && snapshots.length > 1 && (
                <p
                  className={cn(
                    "mt-1 inline-flex items-center gap-1 text-sm font-semibold",
                    change.change > 0 ? "text-income" : change.change < 0 ? "text-expense" : "text-muted-foreground",
                  )}
                >
                  {change.change > 0 && <ArrowUpRight className="size-4" />}
                  {change.change < 0 && <ArrowDownRight className="size-4" />}
                  {t("changeSince", {
                    date: formatDate(snapshots[0].date, locale, { day: "numeric", month: "short" }),
                    amount: `${change.change > 0 ? "+" : change.change < 0 ? "−" : ""}${money(Math.abs(change.change))}`,
                  })}
                  {change.percent !== null && ` (${percent.format(change.percent)})`}
                </p>
              )}
            </Card>
          </div>

          <Card title={t("breakdown")} index={3}>
            <ul className="divide-y">
              {sortItems(result.netWorth.items).map((item) => (
                <li key={`${item.kind}-${item.id}`} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{item.name}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {item.kind === "account" ? tAcc("title") : item.amount < 0 ? tDebt("owedByMe") : tDebt("owedToMe")}
                      {item.currency !== user.currency && ` · ${money(item.amount, item.currency)}`}
                    </p>
                  </div>
                  <p className={cn("amount font-bold", item.converted < 0 ? "text-expense" : "text-income")}>
                    {item.converted < 0 ? "−" : "+"}
                    {money(Math.abs(item.converted))}
                  </p>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">{t("note")}</p>
          </Card>

          <Card title={t("historyTitle")} index={4}>
            {snapshots.length >= 2 ? (
              <NetWorthChart data={snapshots} currency={user.currency} label={t("net")} ariaLabel={t("chartAria")} />
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">{t("historyHint")}</p>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

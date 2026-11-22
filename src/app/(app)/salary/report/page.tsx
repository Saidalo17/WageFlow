import { ArrowLeft } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { PrintButton } from "@/components/salary/print-button";
import { ReportChart } from "@/components/salary/report-chart";
import { formatDate, todayISO } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { buildReport, resolveReportPeriod } from "@/lib/salary-report";
import { listSalaryRecords, salaryMonthlyTotals } from "@/lib/services/salary";
import { getCurrentUser } from "@/lib/session";
import { cn } from "@/lib/utils";

export async function generateMetadata() {
  const t = await getTranslations("salary");
  return { title: t("report.title") };
}

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** A sheet for printing or saving as PDF: totals, a chart, the months and every saved calculation of a period. */
export default async function SalaryReportPage({ searchParams }: PageProps<"/salary/report">) {
  const user = await getCurrentUser();
  const sp = await searchParams;
  const now = new Date();
  const period = resolveReportPeriod(first(sp.period), now);
  const [t, locale, records, allMonths] = await Promise.all([
    getTranslations("salary"),
    getLocale(),
    listSalaryRecords(user.id, 1000, { from: period.from, to: period.to }),
    salaryMonthlyTotals(user.id, user.currency, "2000-01"),
  ]);
  const report = buildReport(records, user.currency, period);
  const years = [...new Set(allMonths.map((m) => Number(m.month.slice(0, 4))))].sort((a, b) => b - a);

  const money = (minor: number) => formatMoney(minor, user.currency, locale);
  const date = (iso: string) => formatDate(iso, locale);
  const periodLabel = `${date(period.from)} – ${date(period.to)}`;
  const bonuses = report.records.flatMap((r) => r.bonuses.map((b) => ({ ...b, payDate: r.payDate })));
  const paidMonths = report.months.filter((m) => m.count > 0);

  const chip = (active: boolean) =>
    cn(
      "inline-flex h-9 items-center rounded-full border px-4 text-sm font-semibold transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
      active
        ? "border-transparent bg-accent text-accent-foreground"
        : "bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
    );

  const th = "border-b border-neutral-300 py-2 text-left text-xs font-semibold tracking-wide text-neutral-500 uppercase";
  const num = "amount py-2 text-right tabular-nums";

  return (
    <div className="mx-auto max-w-[820px] space-y-5">
      {/* Controls: only on screen */}
      <div className="space-y-4 print:hidden">
        <Link
          href="/salary"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-link hover:underline"
        >
          <ArrowLeft className="size-4" />
          {t("report.back")}
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2" role="group" aria-label={t("analytics.period")}>
            <Link href="/salary/report" className={chip(period.kind === "12m")}>
              {t("report.last12")}
            </Link>
            {years.map((y) => (
              <Link
                key={y}
                href={`/salary/report?period=${y}`}
                className={chip(period.kind === "year" && period.year === y)}
              >
                {y}
              </Link>
            ))}
          </div>
          <PrintButton label={t("report.print")} auto={first(sp.print) === "1"} />
        </div>
        <p className="text-sm text-muted-foreground">{t("report.printHint")}</p>
      </div>

      {/* The sheet. Always light, whatever the theme is. */}
      <article className="report space-y-7 rounded-3xl bg-white p-6 text-neutral-900 shadow-[var(--shadow-card)] sm:p-10 print:rounded-none print:p-0 print:shadow-none">
        <header className="flex items-start justify-between gap-4 break-inside-avoid">
          <div className="space-y-1">
            <h1 className="text-2xl font-extrabold tracking-tight">{t("report.title")}</h1>
            <p className="text-neutral-600">{periodLabel}</p>
            <p className="text-sm text-neutral-600">{user.name || user.email}</p>
          </div>
          <div className="flex items-center gap-2 text-lg font-extrabold">
            <Image src="/logo.png" alt="" width={32} height={32} className="size-8 rounded-lg" />
            WageFlow
          </div>
        </header>

        {report.total.count === 0 ? (
          <p className="rounded-2xl bg-neutral-100 px-5 py-8 text-center text-neutral-600">{t("report.noData")}</p>
        ) : (
          <>
            <section aria-label={t("report.summary")} className="grid grid-cols-2 gap-3 break-inside-avoid sm:grid-cols-4">
              {(
                [
                  [t("gross"), report.total.gross],
                  [t("deductions"), report.total.deductions],
                  [t("net"), report.total.net],
                  [t("bonusTotal"), report.total.bonus],
                ] as const
              ).map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-neutral-200 p-4">
                  <p className="text-xs text-neutral-500">{label}</p>
                  <p className="amount mt-1 text-lg font-extrabold">{money(value)}</p>
                </div>
              ))}
            </section>

            <ReportChart
              months={report.months}
              locale={locale}
              labels={{ gross: t("gross"), net: t("net") }}
              ariaLabel={t("analytics.chartAria")}
            />

            <section className="break-inside-avoid">
              <h2 className="mb-2 text-base font-bold">{t("report.monthsTitle")}</h2>
              <div className="overflow-x-auto print:overflow-visible">
<table className="w-full min-w-[420px] text-sm print:min-w-0">
                <thead>
                  <tr>
                    <th className={th}>{t("report.month")}</th>
                    <th className={cn(th, "text-right")}>{t("gross")}</th>
                    <th className={cn(th, "text-right")}>{t("deductions")}</th>
                    <th className={cn(th, "text-right")}>{t("net")}</th>
                  </tr>
                </thead>
                <tbody>
                  {paidMonths.map((m) => (
                    <tr key={m.month} className="border-b border-neutral-100">
                      <td className="py-2">{formatDate(`${m.month}-01`, locale, { month: "long", year: "numeric" })}</td>
                      <td className={num}>{money(m.gross)}</td>
                      <td className={num}>{money(m.deductions)}</td>
                      <td className={cn(num, "font-semibold")}>{money(m.net)}</td>
                    </tr>
                  ))}
                  <tr className="font-bold">
                    <td className="pt-3">{t("report.total")}</td>
                    <td className={cn(num, "pt-3")}>{money(report.total.gross)}</td>
                    <td className={cn(num, "pt-3")}>{money(report.total.deductions)}</td>
                    <td className={cn(num, "pt-3")}>{money(report.total.net)}</td>
                  </tr>
                </tbody>
              </table>
</div>
            </section>

            <section>
              <h2 className="mb-2 text-base font-bold">{t("report.recordsTitle")}</h2>
              <div className="overflow-x-auto print:overflow-visible">
<table className="w-full min-w-[420px] text-sm print:min-w-0">
                <thead>
                  <tr>
                    <th className={th}>{t("report.date")}</th>
                    <th className={th}>{t("report.name")}</th>
                    <th className={cn(th, "text-right")}>{t("gross")}</th>
                    <th className={cn(th, "text-right")}>{t("deductions")}</th>
                    <th className={cn(th, "text-right")}>{t("net")}</th>
                  </tr>
                </thead>
                <tbody>
                  {report.records
                    .filter((r) => r.payDate >= period.from && r.payDate <= period.to)
                    .map((r) => (
                      <tr key={r.id} className="break-inside-avoid border-b border-neutral-100">
                        <td className="py-2 whitespace-nowrap">{date(r.payDate)}</td>
                        <td className="py-2 pr-2">{r.title || t(`modes.${r.mode}`)}</td>
                        <td className={num}>{money(r.gross)}</td>
                        <td className={num}>{money(r.deductionTotal)}</td>
                        <td className={cn(num, "font-semibold")}>{money(r.net)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
</div>
            </section>

            {bonuses.length > 0 && (
              <section className="break-inside-avoid">
                <h2 className="mb-2 text-base font-bold">{t("bonusHistoryTitle")}</h2>
                <div className="overflow-x-auto print:overflow-visible">
<table className="w-full min-w-[420px] text-sm print:min-w-0">
                  <tbody>
                    {bonuses.map((b) => (
                      <tr key={b.id} className="border-b border-neutral-100">
                        <td className="py-2 whitespace-nowrap">{date(b.payDate)}</td>
                        <td className="py-2 pr-2">{b.label}</td>
                        <td className={num}>{money(b.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
</div>
              </section>
            )}
          </>
        )}

        <footer className="space-y-1 border-t border-neutral-200 pt-4 text-xs text-neutral-500 break-inside-avoid">
          {report.otherCurrency > 0 && <p>{t("report.otherCurrency", { count: report.otherCurrency })}</p>}
          <p>{t("report.estimateNote")}</p>
          <p>{t("report.created", { date: date(todayISO(now)) })}</p>
        </footer>
      </article>
    </div>
  );
}

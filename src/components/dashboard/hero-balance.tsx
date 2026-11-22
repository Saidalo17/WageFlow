import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { CountUp } from "./count-up";
import { Sparkline } from "./sparkline";

/**
 * The big tile of the dashboard: the balance of the period (income minus expenses), how it moved against the
 * previous period, and the shape of it day by day. Always a dark emerald-to-navy surface, in both themes.
 */
export async function HeroBalance({
  balance,
  previousBalance,
  curve,
  currency,
  locale,
  className,
}: {
  balance: number;
  previousBalance: number;
  /** Running balance over the period, for the little chart. */
  curve: number[];
  currency: string;
  locale: string;
  className?: string;
}) {
  const t = await getTranslations("overview");
  const delta = balance - previousBalance;
  const sign = balance > 0 ? "+" : balance < 0 ? "−" : "";

  return (
    <section
      className={cn(
        "reveal lift relative overflow-hidden rounded-3xl p-6 text-white shadow-[var(--shadow-card)]",
        "bg-[linear-gradient(135deg,var(--hero-from),var(--hero-to))]",
        className,
      )}
      style={{ "--i": 0 } as React.CSSProperties}
    >
      {/* Soft light spots: decoration only */}
      <div aria-hidden className="pointer-events-none absolute -top-16 -right-10 size-64 rounded-full bg-[radial-gradient(circle,rgba(214,181,109,0.28),transparent_65%)]" />
      <div aria-hidden className="pointer-events-none absolute -bottom-24 -left-10 size-72 rounded-full bg-[radial-gradient(circle,rgba(18,185,129,0.35),transparent_65%)]" />

      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold">{t("balance")}</p>
          <p className="amount mt-1 text-[40px] leading-tight font-extrabold break-words">
            <CountUp value={Math.abs(balance)} currency={currency} sign={sign} />
          </p>
          <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-sm font-semibold backdrop-blur-sm">
            {delta >= 0 ? <ArrowUpRight className="size-4" /> : <ArrowDownRight className="size-4" />}
            {t("vsPrevious", { change: `${delta >= 0 ? "+" : "−"}${formatMoney(Math.abs(delta), currency, locale)}` })}
          </p>
        </div>
        <Image src="/logo.png" alt="" width={72} height={72} className="hidden size-[72px] shrink-0 rounded-2xl object-cover opacity-95 shadow-lg sm:block" />
      </div>

      <Sparkline values={curve} className="relative mt-4 text-emerald-300" />
    </section>
  );
}

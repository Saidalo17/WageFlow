import { intlLocale } from "@/lib/intl-locale";
import { Lightbulb, Sparkles, TrendingUp, TriangleAlert } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Card } from "@/components/card";
import type { Insight, InsightTone } from "@/lib/insights";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

const ICON = { good: TrendingUp, warn: TriangleAlert, info: Lightbulb } as const;
const TONE: Record<InsightTone, string> = {
  good: "bg-income-bg text-income",
  warn: "bg-[color-mix(in_oklab,var(--warning)_16%,transparent)] text-warning",
  info: "bg-accent text-accent-foreground",
};

/** A few plain-language observations about the period. Every line comes from a fixed rule over the user's own numbers. */
export async function InsightsTile({
  insights,
  currency,
  index,
  className,
}: {
  insights: Insight[];
  currency: string;
  index: number;
  className?: string;
}) {
  const [t, locale] = await Promise.all([getTranslations("overview.insights"), getLocale()]);
  const percent = new Intl.NumberFormat(intlLocale(locale), { style: "percent", maximumFractionDigits: 0 });

  return (
    <Card
      title={t("title")}
      index={index}
      className={cn("lift", className)}
      action={<Sparkles className="size-5 text-gold-text" aria-hidden />}
    >
      <p className="-mt-2 mb-3 text-sm text-muted-foreground">{t("subtitle")}</p>
      {insights.length === 0 ? (
        <p className="py-4 text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="space-y-3">
          {insights.map((i) => {
            const Icon = ICON[i.tone];
            return (
              <li key={i.key} className="flex items-start gap-3">
                <span className={cn("mt-0.5 grid size-8 shrink-0 place-items-center rounded-full", TONE[i.tone])}>
                  <Icon className="size-4" />
                </span>
                <p className="text-sm leading-relaxed font-medium">
                  {t(i.key, {
                    percent: i.values.percent !== undefined ? percent.format(i.values.percent) : "",
                    amount: i.values.amount !== undefined ? formatMoney(i.values.amount, currency, locale) : "",
                    name: i.values.name ?? "",
                  })}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

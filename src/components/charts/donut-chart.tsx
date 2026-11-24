"use client";

import { intlLocale } from "@/lib/intl-locale";
import { useLocale, useTranslations } from "next-intl";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { useCategoryName } from "@/components/categories/use-category-name";
import { formatMoney } from "@/lib/money";
import type { CategoryTotal } from "@/lib/services/analytics";
import { useReducedMotion } from "@/lib/use-reduced-motion";

const MAX_SLICES = 8;
const OTHER_COLOR = "#64748B";

type Slice = { key: string; name: string; value: number; color: string };

export function DonutChart({
  data,
  currency,
  ariaLabel,
  height = 220,
}: {
  data: CategoryTotal[];
  currency: string;
  ariaLabel: string;
  height?: number;
}) {
  const t = useTranslations("charts");
  const locale = useLocale();
  const reduced = useReducedMotion();
  const categoryName = useCategoryName();

  const total = data.reduce((s, d) => s + d.total, 0);

  // The biggest categories get their own slice; the rest is grouped into "Other".
  const head: Slice[] = data.slice(0, MAX_SLICES).map((d) => ({
    key: d.categoryId,
    name: categoryName(d),
    value: d.total,
    color: d.color,
  }));
  const rest = data.slice(MAX_SLICES).reduce((s, d) => s + d.total, 0);
  const slices: Slice[] = rest > 0 ? [...head, { key: "_other", name: t("other"), value: rest, color: OTHER_COLOR }] : head;

  const percent = (v: number) =>
    new Intl.NumberFormat(intlLocale(locale), { style: "percent", maximumFractionDigits: 1 }).format(total ? v / total : 0);

  return (
    <div className="space-y-4">
      <div role="img" aria-label={ariaLabel} className="relative w-full" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 260, height }}>
          <PieChart>
            <Pie
              data={slices}
              dataKey="value"
              nameKey="name"
              innerRadius="66%"
              outerRadius="96%"
              paddingAngle={slices.length > 1 ? 2 : 0}
              stroke="none"
              isAnimationActive={!reduced}
              animationDuration={600}
              animationEasing="ease-out"
            >
              {slices.map((s) => (
                <Cell key={s.key} fill={s.color} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const s = payload[0].payload as Slice;
                return (
                  <div className="rounded-xl border bg-popover px-3 py-2 text-sm shadow-lg">
                    <p className="flex items-center gap-2 font-bold">
                      <span className="size-2 rounded-full" style={{ backgroundColor: s.color }} />
                      {s.name}
                    </p>
                    <p className="amount">
                      {formatMoney(s.value, currency, locale)} · {percent(s.value)}
                    </p>
                  </div>
                );
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        {/* Total in the hole of the donut */}
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="max-w-[55%] text-center">
            <p className="text-xs font-medium text-muted-foreground">{t("total")}</p>
            <p className="amount text-lg leading-tight font-extrabold break-words">
              {formatMoney(total, currency, locale)}
            </p>
          </div>
        </div>
      </div>

      {/* The legend doubles as a text version of the chart, so it does not depend on colors. */}
      <ul className="space-y-2">
        {slices.map((s) => (
          <li key={s.key} className="flex items-center gap-3 text-sm">
            <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: s.color }} aria-hidden />
            <span className="min-w-0 flex-1 truncate font-semibold">{s.name}</span>
            <span className="amount text-muted-foreground">{percent(s.value)}</span>
            <span className="amount w-28 shrink-0 text-end font-bold">{formatMoney(s.value, currency, locale)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

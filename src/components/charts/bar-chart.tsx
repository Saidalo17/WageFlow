"use client";

import { useLocale } from "next-intl";
import {
  Bar,
  BarChart as RechartsBarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatDate } from "@/lib/format";
import { formatMoney, fromMinor } from "@/lib/money";
import type { SeriesPoint } from "@/lib/services/analytics";
import { useReducedMotion } from "@/lib/use-reduced-motion";

/** Income and expenses side by side for each month. `date` of every point is YYYY-MM. */
export function BarChart({
  data,
  currency,
  labels,
  ariaLabel,
  height = 280,
}: {
  data: SeriesPoint[];
  currency: string;
  labels: { income: string; expense: string };
  ariaLabel: string;
  height?: number;
}) {
  const locale = useLocale();
  const reduced = useReducedMotion();
  const compact = new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 });
  const axisStyle = { fill: "var(--muted-foreground)", fontSize: 12 } as const;

  // Show the year only where it helps: the first month and every January.
  const tick = (key: string, index: number) =>
    formatDate(
      `${key}-01`,
      locale,
      index === 0 || key.endsWith("-01")
        ? { month: "short", year: "2-digit" }
        : { month: "short" },
    );

  return (
    <div role="img" aria-label={ariaLabel} style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 600, height }}>
        <RechartsBarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barGap={4}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" style={{ stroke: "var(--border)" }} />
          <XAxis
            dataKey="date"
            tickFormatter={tick}
            tick={axisStyle}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            interval={0}
          />
          <YAxis
            width="auto"
            tick={axisStyle}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => compact.format(fromMinor(v, currency))}
          />
          <Tooltip
            cursor={{ style: { fill: "var(--muted)", opacity: 0.5 } }}
            content={({ active, payload, label: key }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as SeriesPoint;
              return (
                <div className="rounded-xl border bg-popover px-3 py-2 text-sm shadow-lg">
                  <p className="mb-1 font-bold">
                    {formatDate(`${String(key)}-01`, locale, { month: "long", year: "numeric" })}
                  </p>
                  <p className="amount flex items-center gap-2 text-income">
                    <span className="size-2 rounded-full bg-income" />
                    {labels.income}: +{formatMoney(p.income, currency, locale)}
                  </p>
                  <p className="amount flex items-center gap-2 text-expense">
                    <span className="size-2 rounded-full bg-expense" />
                    {labels.expense}: −{formatMoney(p.expense, currency, locale)}
                  </p>
                </div>
              );
            }}
          />
          <Bar
            dataKey="income"
            name={labels.income}
            fill="var(--income)"
            radius={[6, 6, 0, 0]}
            maxBarSize={28}
            isAnimationActive={!reduced}
            animationDuration={600}
            animationEasing="ease-out"
          />
          <Bar
            dataKey="expense"
            name={labels.expense}
            fill="var(--expense)"
            radius={[6, 6, 0, 0]}
            maxBarSize={28}
            isAnimationActive={!reduced}
            animationDuration={600}
            animationEasing="ease-out"
          />
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  );
}

"use client";

import { useId } from "react";
import { useLocale } from "next-intl";
import {
  Area,
  AreaChart as RechartsAreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatDate } from "@/lib/format";
import { formatMoney, fromMinor } from "@/lib/money";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import type { Granularity, SeriesPoint } from "@/lib/services/analytics";

type Props = {
  data: SeriesPoint[];
  currency: string;
  granularity: Granularity;
  labels: { income: string; expense: string };
  /** Short description for screen readers. */
  ariaLabel: string;
  height?: number;
};

export function AreaChart({ data, currency, granularity, labels, ariaLabel, height = 260 }: Props) {
  const locale = useLocale();
  const reduced = useReducedMotion();
  const uid = useId().replace(/:/g, "");

  const label = (key: string) =>
    granularity === "month"
      ? formatDate(`${key}-01`, locale, { month: "long", year: "numeric" })
      : formatDate(key, locale, { weekday: "short", day: "numeric", month: "long" });

  const tick = (key: string) =>
    granularity === "month"
      ? formatDate(`${key}-01`, locale, { month: "short" })
      : formatDate(key, locale, { day: "numeric", month: "short" });

  const compact = new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 });
  const axisStyle = { fill: "var(--muted-foreground)", fontSize: 12 } as const;

  return (
    <div role="img" aria-label={ariaLabel} style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 600, height }}>
        <RechartsAreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            {(["income", "expense"] as const).map((k) => (
              <linearGradient key={k} id={`${uid}-${k}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" style={{ stopColor: `var(--${k})`, stopOpacity: 0.35 }} />
                <stop offset="100%" style={{ stopColor: `var(--${k})`, stopOpacity: 0 }} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid vertical={false} strokeDasharray="3 3" style={{ stroke: "var(--border)" }} />
          <XAxis
            dataKey="date"
            tickFormatter={tick}
            tick={axisStyle}
            tickLine={false}
            axisLine={false}
            minTickGap={28}
            tickMargin={8}
          />
          <YAxis
            width="auto"
            tick={axisStyle}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => compact.format(fromMinor(v, currency))}
          />
          <Tooltip
            cursor={{ style: { stroke: "var(--muted-foreground)", strokeDasharray: "4 4" } }}
            content={({ active, payload, label: key }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as SeriesPoint;
              return (
                <div className="rounded-xl border bg-popover px-3 py-2 text-sm shadow-lg">
                  <p className="mb-1 font-bold">{label(String(key))}</p>
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
          <Area
            type="monotone"
            dataKey="income"
            name={labels.income}
            style={{ stroke: "var(--income)" }}
            strokeWidth={2.5}
            fill={`url(#${uid}-income)`}
            isAnimationActive={!reduced}
            animationDuration={600}
            animationEasing="ease-out"
            dot={false}
            activeDot={{ r: 5 }}
          />
          <Area
            type="monotone"
            dataKey="expense"
            name={labels.expense}
            style={{ stroke: "var(--expense)" }}
            strokeWidth={2.5}
            fill={`url(#${uid}-expense)`}
            isAnimationActive={!reduced}
            animationDuration={600}
            animationEasing="ease-out"
            dot={false}
            activeDot={{ r: 5 }}
          />
        </RechartsAreaChart>
      </ResponsiveContainer>
    </div>
  );
}

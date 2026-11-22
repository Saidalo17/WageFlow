"use client";

import { useId } from "react";
import { useLocale } from "next-intl";
import { Area, AreaChart as RechartsAreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatDate } from "@/lib/format";
import { formatMoney, fromMinor } from "@/lib/money";
import { useIsMobile } from "@/lib/use-media";
import { useReducedMotion } from "@/lib/use-reduced-motion";

export type NetWorthPoint = { date: string; netWorth: number };

/** Net worth over time, one point per saved day. */
export function NetWorthChart({
  data,
  currency,
  label,
  ariaLabel,
  height = 240,
}: {
  data: NetWorthPoint[];
  currency: string;
  label: string;
  ariaLabel: string;
  height?: number;
}) {
  const locale = useLocale();
  const reduced = useReducedMotion();
  const mobile = useIsMobile();
  const uid = useId().replace(/:/g, "");
  const compact = new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 });
  const axisStyle = { fill: "var(--muted-foreground)", fontSize: 12 } as const;

  return (
    <div role="img" aria-label={ariaLabel} style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 600, height }}>
        <RechartsAreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={`${uid}-nw`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" style={{ stopColor: "var(--primary)", stopOpacity: 0.35 }} />
              <stop offset="100%" style={{ stopColor: "var(--primary)", stopOpacity: 0 }} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} strokeDasharray="3 3" style={{ stroke: "var(--border)" }} />
          <XAxis
            dataKey="date"
            tickFormatter={(d: string) => formatDate(d, locale, { day: "numeric", month: "short" })}
            tick={axisStyle}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            minTickGap={mobile ? 36 : 24}
          />
          <YAxis
            width="auto"
            tick={axisStyle}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => compact.format(fromMinor(v, currency))}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as NetWorthPoint;
              return (
                <div className="rounded-xl border bg-popover px-3 py-2 text-sm shadow-lg">
                  <p className="mb-1 font-bold">{formatDate(p.date, locale, { day: "numeric", month: "long", year: "numeric" })}</p>
                  <p className="amount">
                    {label}: {formatMoney(p.netWorth, currency, locale)}
                  </p>
                </div>
              );
            }}
          />
          <Area
            type="monotone"
            dataKey="netWorth"
            stroke="var(--primary)"
            strokeWidth={2.5}
            fill={`url(#${uid}-nw)`}
            isAnimationActive={!reduced}
            animationDuration={600}
          />
        </RechartsAreaChart>
      </ResponsiveContainer>
    </div>
  );
}

"use client";

import { intlLocale } from "@/lib/intl-locale";
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
import { useIsMobile } from "@/lib/use-media";
import { useReducedMotion } from "@/lib/use-reduced-motion";

export type SalaryPoint = {
  /** YYYY-MM */
  month: string;
  gross: number;
  net: number;
  /** Predicted net pay; only set for future months. */
  forecast?: number;
};

/** Gross and net pay for each month, with the forecast months drawn lighter at the end. */
export function SalaryChart({
  data,
  currency,
  labels,
  ariaLabel,
  height = 280,
}: {
  data: SalaryPoint[];
  currency: string;
  labels: { gross: string; net: string; forecast: string };
  ariaLabel: string;
  height?: number;
}) {
  const locale = useLocale();
  const reduced = useReducedMotion();
  const mobile = useIsMobile();
  const compact = new Intl.NumberFormat(intlLocale(locale), { notation: "compact", maximumFractionDigits: 1 });
  const axisStyle = { fill: "var(--muted-foreground)", fontSize: 12 } as const;
  const dense = data.length > 8;

  const tick = (key: string, index: number) =>
    formatDate(
      `${key}-01`,
      locale,
      !mobile && (index === 0 || key.endsWith("-01")) ? { month: "short", year: "2-digit" } : { month: "short" },
    );

  return (
    <div role="img" aria-label={ariaLabel} style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 600, height }}>
        <RechartsBarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barGap={dense ? 1 : 4}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" style={{ stroke: "var(--border)" }} />
          <XAxis
            dataKey="month"
            tickFormatter={tick}
            tick={axisStyle}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            interval={mobile ? 1 : 0}
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
              const p = payload[0].payload as SalaryPoint;
              return (
                <div className="rounded-xl border bg-popover px-3 py-2 text-sm shadow-lg">
                  <p className="mb-1 font-bold">
                    {formatDate(`${String(key)}-01`, locale, { month: "long", year: "numeric" })}
                  </p>
                  {p.forecast !== undefined ? (
                    <p className="amount flex items-center gap-2 text-income">
                      <span className="size-2 rounded-full bg-income opacity-40" />
                      {labels.forecast}: {formatMoney(p.forecast, currency, locale)}
                    </p>
                  ) : (
                    <>
                      <p className="amount flex items-center gap-2 text-muted-foreground">
                        <span className="size-2 rounded-full bg-muted-foreground" />
                        {labels.gross}: {formatMoney(p.gross, currency, locale)}
                      </p>
                      <p className="amount flex items-center gap-2 text-income">
                        <span className="size-2 rounded-full bg-income" />
                        {labels.net}: {formatMoney(p.net, currency, locale)}
                      </p>
                    </>
                  )}
                </div>
              );
            }}
          />
          <Bar
            dataKey="gross"
            name={labels.gross}
            fill="var(--muted-foreground)"
            fillOpacity={0.45}
            radius={[6, 6, 0, 0]}
            maxBarSize={dense ? 16 : 28}
            isAnimationActive={!reduced}
            animationDuration={600}
          />
          <Bar
            dataKey="net"
            name={labels.net}
            fill="var(--income)"
            radius={[6, 6, 0, 0]}
            maxBarSize={dense ? 16 : 28}
            isAnimationActive={!reduced}
            animationDuration={600}
          />
          <Bar
            dataKey="forecast"
            name={labels.forecast}
            fill="var(--income)"
            fillOpacity={0.3}
            stroke="var(--income)"
            strokeDasharray="4 3"
            radius={[6, 6, 0, 0]}
            maxBarSize={dense ? 16 : 28}
            isAnimationActive={!reduced}
            animationDuration={600}
          />
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  );
}

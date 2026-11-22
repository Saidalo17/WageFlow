"use client";

import dynamic from "next/dynamic";

/**
 * Recharts is the heaviest library of the app. The charts are loaded after the page is
 * already shown and interactive, so the numbers and the menu appear sooner.
 * A grey placeholder keeps the space while a chart loads.
 */
function ChartPlaceholder() {
  return <div aria-hidden className="h-[260px] w-full animate-pulse rounded-2xl bg-muted/60" />;
}

export const AreaChart = dynamic(() => import("./area-chart").then((m) => m.AreaChart), {
  ssr: false,
  loading: ChartPlaceholder,
});

export const BarChart = dynamic(() => import("./bar-chart").then((m) => m.BarChart), {
  ssr: false,
  loading: ChartPlaceholder,
});

export const DonutChart = dynamic(() => import("./donut-chart").then((m) => m.DonutChart), {
  ssr: false,
  loading: ChartPlaceholder,
});

export const SalaryChart = dynamic(() => import("./salary-chart").then((m) => m.SalaryChart), {
  ssr: false,
  loading: ChartPlaceholder,
});

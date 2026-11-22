/**
 * Grid for the spending heatmap: weeks as columns, Monday to Sunday as rows, one cell per day.
 * Pure functions; dates are "YYYY-MM-DD".
 */

import { addDaysISO } from "@/lib/salary-schedule";

export type HeatLevel = 0 | 1 | 2 | 3 | 4;

export type HeatCell = {
  date: string;
  /** Spent that day, minor units. */
  value: number;
  level: HeatLevel;
  /** False for days after today (the unfinished last week). */
  inRange: boolean;
};

export type Heatmap = { columns: HeatCell[][]; max: number; total: number };

/** 0 = Monday ... 6 = Sunday. */
function weekday(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

/** The darkness of a day from where it sits among the days with spending (quartiles), so one huge day does not wash out the rest. */
export function levelFor(value: number, thresholds: [number, number, number]): HeatLevel {
  if (value <= 0) return 0;
  if (value <= thresholds[0]) return 1;
  if (value <= thresholds[1]) return 2;
  if (value <= thresholds[2]) return 3;
  return 4;
}

function quartiles(values: number[]): [number, number, number] {
  if (values.length === 0) return [0, 0, 0];
  const sorted = [...values].sort((a, b) => a - b);
  const at = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
  return [at(0.25), at(0.5), at(0.75)];
}

/** The last `weeks` weeks up to and including the week of `today`. */
export function buildHeatmap(spending: { date: string; expense: number }[], today: string, weeks = 13): Heatmap {
  const byDate = new Map(spending.map((s) => [s.date, s.expense]));
  const start = addDaysISO(today, -weekday(today) - 7 * (weeks - 1));
  const thresholds = quartiles([...byDate.values()].filter((v) => v > 0));

  const columns: HeatCell[][] = [];
  let max = 0;
  let total = 0;
  for (let w = 0; w < weeks; w++) {
    const col: HeatCell[] = [];
    for (let d = 0; d < 7; d++) {
      const date = addDaysISO(start, w * 7 + d);
      const inRange = date <= today;
      const value = inRange ? (byDate.get(date) ?? 0) : 0;
      max = Math.max(max, value);
      total += value;
      col.push({ date, value, level: levelFor(value, thresholds), inRange });
    }
    columns.push(col);
  }
  return { columns, max, total };
}

/** First day of the grid, for fetching the data. */
export function heatmapStart(today: string, weeks = 13): string {
  return addDaysISO(today, -weekday(today) - 7 * (weeks - 1));
}

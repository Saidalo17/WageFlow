import { cn } from "@/lib/utils";

/**
 * A tiny line chart with a soft area under it: no axes, no numbers, just the shape of the data.
 * Draws with the current text color (`currentColor`), so the parent decides the color.
 */
export function Sparkline({ values, className }: { values: number[]; className?: string }) {
  const W = 200;
  const H = 48;
  const pad = 3;
  const points = values.length > 1 ? values : [0, 0];
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const x = (i: number) => (i / (points.length - 1)) * W;
  const y = (v: number) => (max === min ? H / 2 : H - pad - ((v - min) / span) * (H - pad * 2));
  const line = points.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden className={cn("h-12 w-full overflow-visible", className)}>
      <path d={`${line} L${W},${H} L0,${H} Z`} fill="currentColor" fillOpacity="0.14" />
      <path d={line} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

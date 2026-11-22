import { formatDate } from "@/lib/format";
import type { MonthTotals } from "@/lib/salary-stats";
import { cn } from "@/lib/utils";

/**
 * Gross and net pay per month as plain HTML bars: they stay sharp and readable at any width (the labels are real
 * text, not scaled drawing), need no script and do not depend on the theme. Colors are fixed on purpose
 * (the report is always a light sheet of paper). On a narrow screen every second month label is hidden.
 */
export function ReportChart({
  months,
  locale,
  labels,
  ariaLabel,
}: {
  months: MonthTotals[];
  locale: string;
  labels: { gross: string; net: string };
  ariaLabel: string;
}) {
  const max = Math.max(...months.map((m) => m.gross), 1);
  const height = (value: number) => (value > 0 ? `${Math.max((value / max) * 100, 1.5)}%` : "0%");

  return (
    <figure className="break-inside-avoid">
      <div role="img" aria-label={ariaLabel} className="flex h-44 items-end gap-1 border-b border-neutral-300 sm:gap-2">
        {months.map((m) => (
          <div key={m.month} className="flex h-full min-w-0 flex-1 items-end justify-center gap-px">
            <div className="w-1/2 max-w-[22px] rounded-t-[3px] bg-[#a1a1aa]" style={{ height: height(m.gross) }} />
            <div className="w-1/2 max-w-[22px] rounded-t-[3px] bg-[#16a34a]" style={{ height: height(m.net) }} />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-1 sm:gap-2" aria-hidden>
        {months.map((m, i) => (
          <span
            key={m.month}
            className={cn("min-w-0 flex-1 truncate text-center text-[10px] text-neutral-600 sm:text-xs", i % 2 === 1 && "max-sm:invisible")}
          >
            {formatDate(`${m.month}-01`, locale, { month: "short" })}
          </span>
        ))}
      </div>
      <figcaption className="mt-2 flex gap-4 text-xs text-neutral-600">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-[#a1a1aa]" aria-hidden />
          {labels.gross}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-[#16a34a]" aria-hidden />
          {labels.net}
        </span>
      </figcaption>
    </figure>
  );
}

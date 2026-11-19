"use client";

import { budgetStatus, type BudgetStatus } from "@/lib/budget-status";
import { useHydrated } from "@/lib/use-hydrated";
import { cn } from "@/lib/utils";

const BAR_COLOR: Record<BudgetStatus, string> = {
  ok: "bg-primary",
  warning: "bg-warning",
  over: "bg-expense",
};

/** Horizontal progress bar that fills from the left when the page appears. */
export function BudgetProgress({
  ratio,
  label,
  className,
}: {
  ratio: number;
  label: string;
  className?: string;
}) {
  const hydrated = useHydrated();
  const status = budgetStatus(ratio);
  const percent = Math.round(ratio * 100);
  const width = Math.min(ratio, 1) * 100;

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.min(percent, 100)}
      aria-valuetext={`${percent}%`}
      className={cn("h-3 w-full overflow-hidden rounded-full bg-muted", className)}
    >
      <div
        className={cn("h-full rounded-full transition-[width] duration-500 ease-out", BAR_COLOR[status])}
        style={{ width: hydrated ? `${width}%` : "0%" }}
      />
    </div>
  );
}

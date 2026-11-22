import { ArrowDownLeft, ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { CountUp } from "./count-up";

/**
 * Income or expenses of the period: icon, rolling amount, change against the previous period and a few bars
 * for the last days. For income a rise is good news (green); for expenses it is a warning (red).
 */
export function StatTile({
  label,
  tone,
  value,
  change,
  bars,
  currency,
  index,
  changeText,
  changeLabel,
  className,
}: {
  label: string;
  tone: "income" | "expense";
  /** Positive minor units. */
  value: number;
  /** Fraction vs the previous period, or null when there is nothing to compare with. */
  change: number | null;
  bars: number[];
  currency: string;
  index: number;
  /** Already formatted change, e.g. "+8.1%". */
  changeText: string | null;
  /** The same change as a sentence ("+8.1% vs previous period"), for screen readers and the tooltip. */
  changeLabel: string | null;
  className?: string;
}) {
  const good = change === null ? null : tone === "income" ? change >= 0 : change <= 0;
  const max = Math.max(...bars, 1);

  return (
    <section
      className={cn("reveal lift flex flex-col justify-between gap-3 rounded-3xl border bg-card p-5 shadow-[var(--shadow-card)]", className)}
      style={{ "--i": index } as React.CSSProperties}
    >
      <div className="flex items-center gap-3">
        <span className={cn("grid size-11 shrink-0 place-items-center rounded-full", tone === "income" ? "bg-income-bg text-income" : "bg-expense-bg text-expense")}>
          {tone === "income" ? <ArrowUpRight className="size-5" /> : <ArrowDownLeft className="size-5" />}
        </span>
        <p className="min-w-0 flex-1 truncate text-sm font-semibold text-muted-foreground">{label}</p>
        <div aria-hidden className="flex h-8 items-end gap-1">
          {bars.slice(-8).map((b, i) => (
            <span
              key={i}
              className={cn("w-1.5 rounded-full", tone === "income" ? "bg-income" : "bg-expense")}
              style={{ height: `${Math.max((b / max) * 100, 10)}%`, opacity: 0.35 + (i / 8) * 0.65 }}
            />
          ))}
        </div>
      </div>

      <div className="min-w-0">
        <p className={cn("amount text-2xl font-extrabold break-words", tone === "income" ? "text-income" : "text-expense")}>
          <CountUp value={value} currency={currency} sign={value > 0 ? (tone === "income" ? "+" : "−") : ""} />
        </p>
        <p
          title={changeLabel ?? undefined}
          className={cn(
            "mt-1 inline-flex items-center gap-1 text-sm font-semibold",
            good === null ? "text-muted-foreground" : good ? "text-income" : "text-expense",
          )}
        >
          {change === null ? <Minus className="size-4" /> : change >= 0 ? <ArrowUpRight className="size-4" /> : <ArrowDownRight className="size-4" />}
          {changeText ?? "—"}
          {changeLabel && <span className="sr-only"> {changeLabel}</span>}
        </p>
      </div>
    </section>
  );
}

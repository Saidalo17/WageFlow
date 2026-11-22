import { ArrowRight, PiggyBank } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Card } from "@/components/card";
import { buttonVariants } from "@/components/ui/button";
import { budgetStatus } from "@/lib/budget-status";
import { cn } from "@/lib/utils";

type Item = { id: string; name: string; color: string; spent: number; limit: number };

const RING_COLOR = { ok: "stroke-primary", warning: "stroke-warning", over: "stroke-expense" } as const;

/** All limits together as a ring ("72% used") with the four biggest ones listed beside it. */
export async function BudgetRing({
  items,
  money,
  index,
  className,
}: {
  items: Item[];
  money: (minor: number) => string;
  index: number;
  className?: string;
}) {
  const t = await getTranslations("overview");
  const spent = items.reduce((s, b) => s + b.spent, 0);
  const limit = items.reduce((s, b) => s + b.limit, 0);
  const ratio = limit > 0 ? spent / limit : 0;
  const status = budgetStatus(ratio);
  const R = 44;
  const C = 2 * Math.PI * R;
  const shown = [...items].sort((a, b) => b.spent / (b.limit || 1) - a.spent / (a.limit || 1)).slice(0, 4);

  return (
    <Card
      title={t("budgetsTitle")}
      index={index}
      className={cn("lift", className)}
      action={
        <Link href="/budgets" className={buttonVariants({ variant: "ghost", size: "sm" })}>
          {items.length > 0 ? t("manage") : t("setLimit")}
          <ArrowRight className="size-3.5" />
        </Link>
      }
    >
      {items.length === 0 ? (
        <div className="grid place-items-center gap-3 py-6 text-center">
          <span className="grid size-12 place-items-center rounded-full bg-accent text-accent-foreground">
            <PiggyBank className="size-5" />
          </span>
          <p className="max-w-[16rem] text-sm text-muted-foreground">{t("budgetsEmpty")}</p>
        </div>
      ) : (
        <div className="flex items-center gap-4">
          <div className="relative size-28 shrink-0" role="img" aria-label={`${Math.round(ratio * 100)}% ${t("used")}`}>
            <svg viewBox="0 0 100 100" className="size-full -rotate-90">
              <circle cx="50" cy="50" r={R} fill="none" strokeWidth="10" className="stroke-muted" />
              <circle
                cx="50"
                cy="50"
                r={R}
                fill="none"
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={C}
                strokeDashoffset={C * (1 - Math.min(ratio, 1))}
                className={cn(RING_COLOR[status], "transition-[stroke-dashoffset] duration-700 ease-out")}
              />
            </svg>
            <div className="absolute inset-0 grid place-content-center text-center">
              <span className="amount text-xl font-extrabold">{Math.round(ratio * 100)}%</span>
              <span className="text-xs text-muted-foreground">{t("used")}</span>
            </div>
          </div>
          <ul className="min-w-0 flex-1 space-y-2">
            {shown.map((b) => (
              <li key={b.id} className="flex items-start gap-2 text-sm">
                <span aria-hidden className="mt-1.5 size-2.5 shrink-0 rounded-full" style={{ background: b.color }} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{b.name}</span>
                  <span className="amount block truncate text-xs text-muted-foreground">
                    {money(b.spent)} / {money(b.limit)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

"use client";

import { Plus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { CategoryFormDialog } from "@/components/categories/category-form-dialog";
import type { CategoryItem } from "@/components/categories/types";
import { useCategoryName } from "@/components/categories/use-category-name";
import { CategoryBadge } from "@/components/category-icon";
import { useTransactionModal } from "@/components/transactions/transaction-modal-provider";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

type Type = "expense" | "income";

/**
 * The user's categories as big tiles. A tap opens the "new transaction" form with that
 * category already chosen, so adding an expense by hand takes two taps and an amount.
 * The last tile creates a new category (with its own icon and color) right here.
 */
export function QuickAdd({ categories, currency }: { categories: CategoryItem[]; currency: string }) {
  const t = useTranslations("overview.quickAdd");
  const tCat = useTranslations("categories");
  const locale = useLocale();
  const categoryName = useCategoryName();
  const { openAdd } = useTransactionModal();

  const [tab, setTab] = useState<Type>("expense");
  const [creating, setCreating] = useState(false);

  const visible = categories.filter((c) => c.type === tab && !c.isArchived);

  return (
    <div className="space-y-4">
      <div role="radiogroup" aria-label={t("type")} className="grid w-full max-w-xs grid-cols-2 gap-1 rounded-full bg-muted p-1">
        {(["expense", "income"] as const).map((v) => {
          const active = tab === v;
          return (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setTab(v)}
              className={cn(
                "h-9 rounded-full text-sm font-bold transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                !active && "text-muted-foreground hover:text-foreground",
                active && v === "expense" && "bg-expense-bg text-expense",
                active && v === "income" && "bg-income-bg text-income",
              )}
            >
              {tCat(v === "expense" ? "expenses" : "income")}
            </button>
          );
        })}
      </div>

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {visible.map((c) => {
          const name = categoryName(c);
          return (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => openAdd(tab, c.id)}
                aria-label={t("addTo", { name })}
                className="group flex h-full w-full flex-col items-center gap-2 rounded-2xl border bg-card p-3 text-center transition-all hover:-translate-y-0.5 hover:bg-muted/50 hover:shadow-[var(--shadow-card)] focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none motion-reduce:transition-none motion-reduce:hover:translate-y-0"
              >
                <CategoryBadge icon={c.icon} color={c.color} className="size-12" />
                <span className="w-full truncate text-sm font-bold">{name}</span>
                <span className="amount w-full truncate text-xs text-muted-foreground">
                  {c.total > 0 ? formatMoney(c.total, currency, locale) : t("noneYet")}
                </span>
              </button>
            </li>
          );
        })}
        <li>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex h-full min-h-[116px] w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-3 text-center text-muted-foreground transition-colors hover:border-primary hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <span className="grid size-12 place-items-center rounded-full bg-muted">
              <Plus className="size-5" aria-hidden />
            </span>
            <span className="text-sm font-bold">{tCat("add")}</span>
          </button>
        </li>
      </ul>

      <CategoryFormDialog open={creating} onOpenChange={setCreating} category={null} defaultType={tab} />
    </div>
  );
}

"use client";

import { ReceiptText } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCategoryName } from "@/components/categories/use-category-name";
import { CategoryBadge } from "@/components/category-icon";
import { Button } from "@/components/ui/button";
import { useTransactionModal } from "@/components/transactions/transaction-modal-provider";
import type { TxItem } from "@/components/transactions/types";
import { formatDate } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

export function RecentTransactions({ items, currency }: { items: TxItem[]; currency: string }) {
  const t = useTranslations("overview");
  const tTx = useTranslations("transactions");
  const locale = useLocale();
  const categoryName = useCategoryName();
  const { openAdd, openEdit } = useTransactionModal();

  if (items.length === 0) {
    return (
      <div className="grid place-items-center gap-3 py-8 text-center">
        <span className="grid size-14 place-items-center rounded-full bg-accent text-accent-foreground">
          <ReceiptText className="size-6" />
        </span>
        <div className="space-y-1">
          <p className="text-lg font-bold">{tTx("empty.title")}</p>
          <p className="text-muted-foreground">{tTx("empty.hint")}</p>
        </div>
        <Button onClick={() => openAdd()}>{t("addFirst")}</Button>
      </div>
    );
  }

  return (
    <ul className="-mx-2 divide-y">
      {items.map((item) => {
        const isIncome = item.type === "income";
        return (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => openEdit(item)}
              className="flex w-full items-center gap-3 rounded-2xl px-2 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <CategoryBadge icon={item.categoryIcon} color={item.categoryColor} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold">
                  {categoryName({ name: item.categoryName, systemKey: item.categorySystemKey })}
                </span>
                <span className="block truncate text-sm text-muted-foreground">
                  {formatDate(item.occurredOn, locale, { day: "numeric", month: "short" })}
                  {item.note ? ` · ${item.note}` : ""}
                </span>
              </span>
              <span className={cn("amount shrink-0 font-extrabold", isIncome ? "text-income" : "text-expense")}>
                {isIncome ? "+" : "−"}
                {formatMoney(item.amount, currency, locale)}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

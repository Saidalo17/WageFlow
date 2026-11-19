"use client";

import {
  CircleAlert,
  Loader2,
  MoreVertical,
  Pencil,
  PiggyBank,
  Plus,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { deleteBudget } from "@/app/(app)/budgets/actions";
import { useCategoryName } from "@/components/categories/use-category-name";
import { CategoryBadge } from "@/components/category-icon";
import type { CategoryOption } from "@/components/transactions/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { budgetStatus } from "@/lib/budget-status";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { BudgetFormDialog, type BudgetItem } from "./budget-form-dialog";
import { BudgetProgress } from "./budget-progress";

type Props = {
  budgets: BudgetItem[];
  available: CategoryOption[];
  currency: string;
  /** Already formatted, e.g. "1 Nov – 30 Nov 2026". */
  periodLabel: string;
};

export function BudgetsView({ budgets, available, currency, periodLabel }: Props) {
  const t = useTranslations("budgets");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const categoryName = useCategoryName();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<BudgetItem | null>(null);
  const [deleting, setDeleting] = useState<BudgetItem | null>(null);
  const [busy, setBusy] = useState(false);

  const money = (minor: number) => formatMoney(minor, currency, locale);
  const percent = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 });

  // The limits that are closest to being used up come first.
  const sorted = [...budgets].sort((a, b) => b.spent / b.limit - a.spent / a.limit);
  const totalLimit = budgets.reduce((s, b) => s + b.limit, 0);
  const totalSpent = budgets.reduce((s, b) => s + b.spent, 0);
  const totalRatio = totalLimit ? totalSpent / totalLimit : 0;

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }
  function openEdit(b: BudgetItem) {
    setEditing(b);
    setFormOpen(true);
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    const result = await deleteBudget(deleting.id);
    setBusy(false);
    setDeleting(null);
    if (result.ok) {
      toast.success(t("toasts.deleted"));
      router.refresh();
    } else {
      toast.error(t(`errors.${result.error}`));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-[28px] font-extrabold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground">{t("subtitle", { period: periodLabel })}</p>
        </div>
        <Button onClick={openCreate} className="gap-1.5">
          <Plus className="size-4" />
          {t("add")}
        </Button>
      </div>

      {budgets.length === 0 ? (
        <div className="grid place-items-center gap-3 rounded-3xl border border-dashed bg-card px-6 py-14 text-center">
          <span className="grid size-14 place-items-center rounded-full bg-accent text-accent-foreground">
            <PiggyBank className="size-6" />
          </span>
          <div className="space-y-1">
            <p className="text-lg font-bold">{t("emptyTitle")}</p>
            <p className="max-w-md text-muted-foreground">{t("emptyHint")}</p>
          </div>
          <Button onClick={openCreate} className="gap-1.5">
            <Plus className="size-4" />
            {t("add")}
          </Button>
        </div>
      ) : (
        <>
          {/* All limits together */}
          <section className="reveal space-y-3 rounded-3xl border bg-card p-5 shadow-[var(--shadow-card)] sm:p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h2 className="text-lg font-bold">{t("totalTitle")}</h2>
              <p className="amount text-muted-foreground">
                <span className="font-extrabold text-foreground">{money(totalSpent)}</span>{" "}
                {t("of", { limit: money(totalLimit) })} · {percent.format(totalRatio)}
              </p>
            </div>
            <BudgetProgress ratio={totalRatio} label={t("totalTitle")} />
          </section>

          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sorted.map((b, i) => {
              const ratio = b.limit ? b.spent / b.limit : 0;
              const status = budgetStatus(ratio);
              const left = b.limit - b.spent;
              const name = categoryName(b);
              return (
                <li
                  key={b.id}
                  style={{ "--i": Math.min(i + 1, 8) } as React.CSSProperties}
                  className="reveal flex flex-col gap-4 rounded-3xl border bg-card p-5 shadow-[var(--shadow-card)]"
                >
                  <div className="flex items-center gap-3">
                    <CategoryBadge icon={b.icon} color={b.color} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold">{name}</p>
                      <p className="amount truncate text-sm text-muted-foreground">
                        <span className="font-semibold text-foreground">{money(b.spent)}</span>{" "}
                        {t("of", { limit: money(b.limit) })}
                      </p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={<Button variant="ghost" size="icon" aria-label={`${t("actions")}: ${name}`} />}
                      >
                        <MoreVertical className="size-5" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="min-w-40">
                        <DropdownMenuItem onClick={() => openEdit(b)}>
                          <Pencil className="size-4" />
                          {t("edit")}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => setDeleting(b)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="size-4" />
                          {t("delete")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <BudgetProgress ratio={ratio} label={name} />

                  {/* Status in words and an icon, so it never depends on color alone */}
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span
                      className={cn(
                        "amount inline-flex items-center gap-1.5 font-semibold",
                        status === "ok" && "text-muted-foreground",
                        status === "warning" && "text-warning",
                        status === "over" && "text-expense",
                      )}
                    >
                      {status === "over" && <CircleAlert className="size-4" />}
                      {status === "warning" && <TriangleAlert className="size-4" />}
                      {left >= 0 ? t("left", { amount: money(left) }) : t("over", { amount: money(-left) })}
                    </span>
                    <span className="amount font-bold">{percent.format(ratio)}</span>
                  </div>
                  {status !== "ok" && (
                    <p
                      className={cn(
                        "-mt-2 text-xs font-semibold",
                        status === "warning" ? "text-warning" : "text-expense",
                      )}
                    >
                      {t(status === "warning" ? "statusWarning" : "statusOver")}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}

      <BudgetFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        budget={editing}
        available={available}
        currency={currency}
      />

      <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-extrabold">{t("deleteTitle")}</DialogTitle>
            <DialogDescription>{deleting && t("deleteBody", { name: categoryName(deleting) })}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="secondary" onClick={() => setDeleting(null)}>
              {tc("cancel")}
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={busy}>
              {busy && <Loader2 className="size-4 animate-spin" />}
              {t("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

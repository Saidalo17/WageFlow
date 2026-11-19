"use client";

import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { createBudget, updateBudget } from "@/app/(app)/budgets/actions";
import { useCategoryName } from "@/components/categories/use-category-name";
import { CategoryBadge } from "@/components/category-icon";
import { ResponsiveModal } from "@/components/responsive-modal";
import type { CategoryOption } from "@/components/transactions/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { currencySymbol, editableAmount, parseMinorAmount } from "@/lib/money-input";
import { cn } from "@/lib/utils";

export type BudgetItem = {
  id: string;
  categoryId: string;
  name: string;
  systemKey: string | null;
  color: string;
  icon: string;
  limit: number;
  spent: number;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Budget being edited, or null to create a new one. */
  budget: BudgetItem | null;
  /** Expense categories that do not have a limit yet. */
  available: CategoryOption[];
  currency: string;
};

export function BudgetFormDialog({ open, onOpenChange, budget, available, currency }: Props) {
  const t = useTranslations("budgets");
  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      title={t(budget ? "editTitle" : "newTitle")}
    >
      <BudgetForm
        key={budget?.id ?? "new"}
        budget={budget}
        available={available}
        currency={currency}
        onDone={() => onOpenChange(false)}
      />
    </ResponsiveModal>
  );
}

function BudgetForm({
  budget,
  available,
  currency,
  onDone,
}: {
  budget: BudgetItem | null;
  available: CategoryOption[];
  currency: string;
  onDone: () => void;
}) {
  const t = useTranslations("budgets");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const categoryName = useCategoryName();

  const [categoryId, setCategoryId] = useState(budget?.categoryId ?? "");
  const [amountText, setAmountText] = useState(budget ? editableAmount(budget.limit, currency, locale) : "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const err = (key: string) => (errors[key] ? t(`errors.${errors[key]}`) : null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    const next: Record<string, string> = {};
    const amount = parseMinorAmount(amountText, locale, currency);
    if (!amount.ok) next.limit = amount.error;
    if (!budget && !categoryId) next.categoryId = "categoryRequired";
    setErrors(next);
    if (Object.keys(next).length > 0 || !amount.ok) return;

    setSaving(true);
    const result = budget
      ? await updateBudget(budget.id, { limit: amount.minor })
      : await createBudget({ categoryId, limit: amount.minor });
    setSaving(false);

    if (result.ok) {
      toast.success(t(budget ? "toasts.updated" : "toasts.created"));
      onDone();
      router.refresh();
    } else if (result.fieldErrors && Object.keys(result.fieldErrors).length > 0) {
      setErrors(result.fieldErrors);
    } else {
      setFormError(result.error);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      {/* Category: chosen when creating, fixed when editing */}
      {budget ? (
        <div className="flex items-center gap-3 rounded-2xl bg-muted p-3">
          <CategoryBadge icon={budget.icon} color={budget.color} />
          <span className="font-bold">{categoryName(budget)}</span>
        </div>
      ) : (
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold">{t("category")}</legend>
          {available.length === 0 ? (
            <p className="rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">
              {t("noCategories")}{" "}
              <Link href="/categories" onClick={onDone} className="font-semibold text-link hover:underline">
                {t("createCategory")}
              </Link>
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={t("category")}>
              {available.map((c) => {
                const active = c.id === categoryId;
                return (
                  <button
                    key={c.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => {
                      setCategoryId(c.id);
                      setErrors((x) => ({ ...x, categoryId: "" }));
                    }}
                    className={cn(
                      "flex min-w-0 flex-col items-center gap-1.5 rounded-2xl border p-2.5 text-center text-xs font-semibold transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                      active && "border-primary bg-accent text-accent-foreground",
                    )}
                  >
                    <CategoryBadge icon={c.icon} color={c.color} className="size-9" />
                    <span className="w-full truncate">{categoryName(c)}</span>
                  </button>
                );
              })}
            </div>
          )}
          {err("categoryId") && (
            <p role="alert" className="text-sm text-destructive">
              {err("categoryId")}
            </p>
          )}
        </fieldset>
      )}

      {/* Monthly limit */}
      <div className="space-y-1.5">
        <Label htmlFor="budget-limit" className="text-sm font-semibold">
          {t("limit")}
        </Label>
        <div className="relative">
          <Input
            id="budget-limit"
            inputMode="decimal"
            autoComplete="off"
            autoFocus={!!budget}
            placeholder="0"
            value={amountText}
            onChange={(e) => setAmountText(e.target.value)}
            aria-invalid={!!errors.limit}
            aria-describedby={errors.limit ? "budget-limit-error" : "budget-limit-hint"}
            className="amount h-14 pr-14 text-2xl font-extrabold"
          />
          <span className="pointer-events-none absolute inset-y-0 right-4 grid place-items-center text-lg font-bold text-muted-foreground">
            {currencySymbol(locale, currency)}
          </span>
        </div>
        {err("limit") ? (
          <p id="budget-limit-error" role="alert" className="text-sm text-destructive">
            {err("limit")}
          </p>
        ) : (
          <p id="budget-limit-hint" className="text-sm text-muted-foreground">
            {t("limitHint")}
          </p>
        )}
      </div>

      {formError && (
        <p role="alert" className="rounded-xl bg-expense-bg px-4 py-3 text-sm font-medium text-expense">
          {t(`errors.${formError}`)}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onDone}>
          {tc("cancel")}
        </Button>
        <Button type="submit" disabled={saving || (!budget && available.length === 0)}>
          {saving && <Loader2 className="size-4 animate-spin" />}
          {t(budget ? "save" : "create")}
        </Button>
      </div>
    </form>
  );
}

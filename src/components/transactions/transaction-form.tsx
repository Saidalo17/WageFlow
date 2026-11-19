"use client";

import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { createTransaction, updateTransaction } from "@/app/(app)/transactions/actions";
import { CategoryBadge } from "@/components/category-icon";
import { useCategoryName } from "@/components/categories/use-category-name";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { todayISO } from "@/lib/format";
import { minorDigits, parseAmount } from "@/lib/money";
import { currencySymbol, editableAmount } from "@/lib/money-input";
import { cn } from "@/lib/utils";
import { MAX_AMOUNT_MAJOR } from "@/lib/validators/transaction";
import type { CategoryOption, TxItem } from "./types";

type Type = "income" | "expense";

export function TransactionForm({
  transaction,
  initialType,
  categories,
  currency,
  onDone,
}: {
  transaction: TxItem | null;
  initialType: Type;
  categories: CategoryOption[];
  currency: string;
  onDone: () => void;
}) {
  const t = useTranslations("transactions");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const categoryName = useCategoryName();

  const [type, setType] = useState<Type>(transaction?.type ?? initialType);
  const [amountText, setAmountText] = useState(
    transaction ? editableAmount(transaction.amount, currency, locale) : "",
  );
  const [categoryId, setCategoryId] = useState(transaction?.categoryId ?? "");
  const [date, setDate] = useState(transaction?.occurredOn ?? todayISO());
  const [note, setNote] = useState(transaction?.note ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const maxDate = (() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    return todayISO(d);
  })();

  // Categories of the chosen type. An archived one is shown only if this transaction already uses it.
  const options = categories.filter(
    (c) => c.type === type && (!c.isArchived || c.id === transaction?.categoryId),
  );
  const selectedValid = options.some((c) => c.id === categoryId);

  function chooseType(next: Type) {
    if (next === type) return;
    setType(next);
    setCategoryId("");
    setErrors((e) => ({ ...e, categoryId: "" }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    const next: Record<string, string> = {};
    const n = parseAmount(amountText, locale);
    const d = minorDigits(currency);
    let minor = 0;
    if (!amountText.trim()) next.amount = "amountRequired";
    else if (n === null || n <= 0) next.amount = "amountInvalid";
    else {
      minor = Math.round(n * 10 ** d);
      if (Math.abs(n * 10 ** d - minor) > 1e-6) next.amount = "amountInvalid"; // too many decimals
      else if (n > MAX_AMOUNT_MAJOR) next.amount = "amountTooLarge";
    }
    if (!selectedValid) next.categoryId = "categoryRequired";
    if (!date) next.occurredOn = "dateInvalid";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSaving(true);
    const payload = { type, categoryId, amount: minor, occurredOn: date, note };
    const result = transaction
      ? await updateTransaction(transaction.id, payload)
      : await createTransaction(payload);
    setSaving(false);

    if (result.ok) {
      toast.success(t(transaction ? "toasts.updated" : "toasts.created"));
      onDone();
      router.refresh();
    } else if (result.fieldErrors && Object.keys(result.fieldErrors).length > 0) {
      setErrors(result.fieldErrors);
    } else {
      setFormError(result.error);
    }
  }

  const symbol = currencySymbol(locale, currency);
  const err = (key: string) => (errors[key] ? t(`errors.${errors[key]}`) : null);

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      {/* Income / expense switch */}
      <div
        role="radiogroup"
        aria-label={t("form.type")}
        className="grid grid-cols-2 gap-1 rounded-full bg-muted p-1"
      >
        {(["expense", "income"] as const).map((v) => {
          const active = type === v;
          return (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => chooseType(v)}
              className={cn(
                "h-10 rounded-full text-sm font-bold transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                !active && "text-muted-foreground hover:text-foreground",
                active && v === "expense" && "bg-expense-bg text-expense",
                active && v === "income" && "bg-income-bg text-income",
              )}
            >
              {v === "expense" ? "− " : "+ "}
              {t(`form.${v}`)}
            </button>
          );
        })}
      </div>

      {/* Amount */}
      <div className="space-y-1.5">
        <Label htmlFor="tx-amount" className="text-sm font-semibold">
          {t("form.amount")}
        </Label>
        <div className="relative">
          <Input
            id="tx-amount"
            inputMode="decimal"
            autoComplete="off"
            autoFocus
            placeholder="0"
            value={amountText}
            onChange={(e) => setAmountText(e.target.value)}
            aria-invalid={!!errors.amount}
            aria-describedby={errors.amount ? "tx-amount-error" : undefined}
            className="amount h-14 pr-14 text-2xl font-extrabold"
          />
          <span className="pointer-events-none absolute inset-y-0 right-4 grid place-items-center text-lg font-bold text-muted-foreground">
            {symbol}
          </span>
        </div>
        {err("amount") && (
          <p id="tx-amount-error" role="alert" className="text-sm text-destructive">
            {err("amount")}
          </p>
        )}
      </div>

      {/* Category */}
      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold">{t("form.category")}</legend>
        {options.length === 0 ? (
          <p className="rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">
            {t("form.noCategories")}{" "}
            <Link href="/categories" onClick={onDone} className="font-semibold text-primary hover:underline">
              {t("form.createCategory")}
            </Link>
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={t("form.category")}>
            {options.map((c) => {
              const active = c.id === categoryId;
              return (
                <button
                  key={c.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => {
                    setCategoryId(c.id);
                    setErrors((e) => ({ ...e, categoryId: "" }));
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

      {/* Date */}
      <div className="space-y-1.5">
        <Label htmlFor="tx-date" className="text-sm font-semibold">
          {t("form.date")}
        </Label>
        <Input
          id="tx-date"
          type="date"
          value={date}
          max={maxDate}
          onChange={(e) => setDate(e.target.value)}
          aria-invalid={!!errors.occurredOn}
        />
        {err("occurredOn") && (
          <p role="alert" className="text-sm text-destructive">
            {err("occurredOn")}
          </p>
        )}
      </div>

      {/* Note */}
      <div className="space-y-1.5">
        <Label htmlFor="tx-note" className="text-sm font-semibold">
          {t("form.note")}
        </Label>
        <Input
          id="tx-note"
          value={note}
          maxLength={200}
          placeholder={t("form.notePlaceholder")}
          onChange={(e) => setNote(e.target.value)}
          aria-invalid={!!errors.note}
        />
        {err("note") && (
          <p role="alert" className="text-sm text-destructive">
            {err("note")}
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
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="size-4 animate-spin" />}
          {t(transaction ? "form.save" : "form.add")}
        </Button>
      </div>
    </form>
  );
}

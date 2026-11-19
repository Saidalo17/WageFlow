"use client";

import {
  ArrowDownLeft,
  ArrowUpRight,
  Loader2,
  MoreVertical,
  Pencil,
  Plus,
  ReceiptText,
  SearchX,
  Trash2,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { deleteTransaction, restoreTransaction } from "@/app/(app)/transactions/actions";
import { useCategoryName } from "@/components/categories/use-category-name";
import { CategoryBadge } from "@/components/category-icon";
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
import { formatDate, todayISO } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { useToday } from "@/lib/use-today";
import type { Range } from "@/lib/period";
import { cn } from "@/lib/utils";
import { TransactionFilters } from "./transaction-filters";
import { useTransactionModal } from "./transaction-modal-provider";
import type { CategoryOption, TxItem } from "./types";

const PAGE_SIZE = 30;

type Props = {
  items: TxItem[];
  hasMore: boolean;
  limit: number;
  totals: { income: number; expense: number };
  currency: string;
  categories: CategoryOption[];
  filters: { range: Range; type: "all" | "expense" | "income"; categoryId: string; q: string };
};

export function TransactionsView({ items, hasMore, limit, totals, currency, categories, filters }: Props) {
  const t = useTranslations("transactions");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const categoryName = useCategoryName();
  const { openAdd, openEdit } = useTransactionModal();

  const [deleting, setDeleting] = useState<TxItem | null>(null);
  const [busy, setBusy] = useState(false);

  const money = (minor: number) => formatMoney(minor, currency, locale);
  const balance = totals.income - totals.expense;

  // Group by day (items are already sorted newest first).
  const groups: { date: string; items: TxItem[] }[] = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (last && last.date === item.occurredOn) last.items.push(item);
    else groups.push({ date: item.occurredOn, items: [item] });
  }

  const { today, yesterday } = useToday();
  const thisYear = Number((today || todayISO()).slice(0, 4));

  function dayLabel(date: string) {
    if (date === today) return t("today");
    if (date === yesterday) return t("yesterday");
    const sameYear = Number(date.slice(0, 4)) === thisYear;
    return formatDate(
      date,
      locale,
      sameYear
        ? { weekday: "long", day: "numeric", month: "long" }
        : { day: "numeric", month: "long", year: "numeric" },
    );
  }

  function dayNet(list: TxItem[]) {
    return list.reduce((sum, i) => sum + (i.type === "income" ? i.amount : -i.amount), 0);
  }

  function setParams(changes: Record<string, string | null>) {
    const next = new URLSearchParams(window.location.search);
    for (const [k, v] of Object.entries(changes)) {
      if (v === null) next.delete(k);
      else next.set(k, v);
    }
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  async function undo(item: TxItem) {
    const result = await restoreTransaction({
      id: item.id,
      type: item.type,
      categoryId: item.categoryId,
      amount: item.amount,
      occurredOn: item.occurredOn,
      note: item.note,
    });
    if (result.ok) {
      toast.success(t("toasts.restored"));
      router.refresh();
    } else {
      toast.error(t(`errors.${result.error}`));
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    const item = deleting;
    setBusy(true);
    const result = await deleteTransaction(item.id);
    setBusy(false);
    setDeleting(null);
    if (result.ok) {
      router.refresh();
      toast(t("toasts.deleted"), {
        duration: 6000,
        action: { label: t("undo"), onClick: () => void undo(item) },
      });
    } else {
      toast.error(t(`errors.${result.error}`));
    }
  }

  const filtered = !!filters.q || !!filters.categoryId || filters.type !== "all" || filters.range !== "all";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[28px] font-extrabold tracking-tight">{t("title")}</h1>
        <Button onClick={() => openAdd()} className="gap-1.5">
          <Plus className="size-4" />
          {t("form.newTitle")}
        </Button>
      </div>

      {/* Totals for everything that matches the filters */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <SummaryCard label={t("summary.income")} tone="income" value={`${totals.income > 0 ? "+" : ""}${money(totals.income)}`} icon={ArrowUpRight} />
        <SummaryCard label={t("summary.expenses")} tone="expense" value={`${totals.expense > 0 ? "−" : ""}${money(totals.expense)}`} icon={ArrowDownLeft} />
        <SummaryCard
          label={t("summary.balance")}
          tone="neutral"
          className="order-first col-span-2 sm:order-none sm:col-span-1"
          value={`${balance > 0 ? "+" : balance < 0 ? "−" : ""}${money(Math.abs(balance))}`}
        />
      </div>

      <TransactionFilters
        range={filters.range}
        type={filters.type}
        categoryId={filters.categoryId}
        q={filters.q}
        categories={categories}
      />

      {items.length === 0 ? (
        <div className="grid place-items-center gap-3 rounded-3xl border border-dashed bg-card px-6 py-14 text-center">
          <span className="grid size-14 place-items-center rounded-full bg-accent text-accent-foreground">
            {filtered ? <SearchX className="size-6" /> : <ReceiptText className="size-6" />}
          </span>
          <div className="space-y-1">
            <p className="text-lg font-bold">{t(filtered ? "noResults.title" : "empty.title")}</p>
            <p className="text-muted-foreground">{t(filtered ? "noResults.hint" : "empty.hint")}</p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <Button onClick={() => openAdd()} className="gap-1.5">
              <Plus className="size-4" />
              {t("form.newTitle")}
            </Button>
            {filtered && (
              <Button
                variant="secondary"
                onClick={() => router.replace(`${pathname}?range=all`, { scroll: false })}
              >
                {t("showAll")}
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map((g, gi) => {
            const net = dayNet(g.items);
            return (
              <section
                key={g.date}
                aria-label={dayLabel(g.date)}
                className="reveal space-y-2"
                style={{ "--i": Math.min(gi, 6) } as React.CSSProperties}
              >
                <div className="flex items-baseline justify-between gap-3 px-1">
                  <h2 className="block text-sm font-bold text-muted-foreground first-letter:uppercase">{dayLabel(g.date)}</h2>
                  <span className="amount text-sm font-semibold text-muted-foreground">
                    {net > 0 ? "+" : net < 0 ? "−" : ""}
                    {money(Math.abs(net))}
                  </span>
                </div>
                <ul className="divide-y overflow-hidden rounded-3xl border bg-card shadow-[var(--shadow-card)]">
                  {g.items.map((item) => {
                    const isIncome = item.type === "income";
                    const name = categoryName({ name: item.categoryName, systemKey: item.categorySystemKey });
                    return (
                      <li key={item.id} className="flex items-center gap-1 pr-2">
                        <button
                          type="button"
                          onClick={() => openEdit(item)}
                          className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl p-4 text-left transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                        >
                          <CategoryBadge icon={item.categoryIcon} color={item.categoryColor} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-bold">{name}</span>
                            {item.note && (
                              <span className="block truncate text-sm text-muted-foreground">{item.note}</span>
                            )}
                          </span>
                          <span
                            className={cn(
                              "amount shrink-0 font-extrabold",
                              isIncome ? "text-income" : "text-expense",
                            )}
                          >
                            {isIncome ? "+" : "−"}
                            {money(item.amount)}
                          </span>
                        </button>
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label={`${t("row.actions")}: ${name}, ${money(item.amount)}`}
                              />
                            }
                          >
                            <MoreVertical className="size-5" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="min-w-40">
                            <DropdownMenuItem onClick={() => openEdit(item)}>
                              <Pencil className="size-4" />
                              {t("row.edit")}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => setDeleting(item)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="size-4" />
                              {t("row.delete")}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}

          {hasMore && (
            <div className="flex justify-center">
              <Button variant="secondary" onClick={() => setParams({ limit: String(limit + PAGE_SIZE) })}>
                {t("showMore")}
              </Button>
            </div>
          )}
        </div>
      )}

      <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-extrabold">{t("delete.title")}</DialogTitle>
            <DialogDescription>
              {deleting &&
                t("delete.body", {
                  category: categoryName({ name: deleting.categoryName, systemKey: deleting.categorySystemKey }),
                  amount: money(deleting.amount),
                  date: formatDate(deleting.occurredOn, locale),
                })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="secondary" onClick={() => setDeleting(null)}>
              {tc("cancel")}
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={busy}>
              {busy && <Loader2 className="size-4 animate-spin" />}
              {t("row.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone,
  icon: Icon,
  className,
}: {
  label: string;
  value: string;
  tone: "income" | "expense" | "neutral";
  icon?: React.ComponentType<{ className?: string }>;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-3 rounded-3xl border bg-card p-4 shadow-[var(--shadow-card)]", className)}>
      {Icon && (
        <span
          className={cn(
            "hidden size-10 shrink-0 place-items-center rounded-full lg:grid",
            tone === "income" ? "bg-income-bg text-income" : "bg-expense-bg text-expense",
          )}
        >
          <Icon className="size-5" />
        </span>
      )}
      <div className="min-w-0">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <p
          className={cn(
            "amount text-lg font-extrabold break-words lg:text-xl",
            tone === "income" && "text-income",
            tone === "expense" && "text-expense",
          )}
        >
          {value}
        </p>
      </div>
    </div>
  );
}

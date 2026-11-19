"use client";

import {
  Archive,
  ArchiveRestore,
  Loader2,
  MoreVertical,
  Pencil,
  Plus,
  Tag,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { archiveCategory, deleteCategory } from "@/app/(app)/categories/actions";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { CategoryFormDialog } from "./category-form-dialog";
import type { CategoryItem } from "./types";
import { useCategoryName } from "./use-category-name";

type Type = "expense" | "income";

export function CategoriesView({
  categories,
  currency,
}: {
  categories: CategoryItem[];
  currency: string;
}) {
  const t = useTranslations("categories");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const displayName = useCategoryName();

  const [tab, setTab] = useState<Type>("expense");
  const [showArchived, setShowArchived] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CategoryItem | null>(null);
  const [deleting, setDeleting] = useState<CategoryItem | null>(null);
  const [deleteState, setDeleteState] = useState<"confirm" | "hasTransactions">("confirm");
  const [busy, setBusy] = useState(false);

  const ofType = categories.filter((c) => c.type === tab);
  const visible = ofType.filter((c) => showArchived || !c.isArchived);
  const archivedCount = ofType.filter((c) => c.isArchived).length;

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }
  function openEdit(c: CategoryItem) {
    setEditing(c);
    setFormOpen(true);
  }
  function openDelete(c: CategoryItem) {
    setDeleteState("confirm");
    setDeleting(c);
  }

  async function setArchived(c: CategoryItem, archived: boolean) {
    const result = await archiveCategory(c.id, archived);
    if (result.ok) {
      toast.success(t(archived ? "toasts.archived" : "toasts.restored"));
      router.refresh();
    } else {
      toast.error(t(`errors.${result.error}`));
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    const result = await deleteCategory(deleting.id);
    setBusy(false);
    if (result.ok) {
      toast.success(t("toasts.deleted"));
      setDeleting(null);
      router.refresh();
    } else if (result.error === "hasTransactions") {
      setDeleteState("hasTransactions");
    } else {
      toast.error(t(`errors.${result.error}`));
      setDeleting(null);
    }
  }

  async function archiveInstead() {
    if (!deleting) return;
    const c = deleting;
    setDeleting(null);
    await setArchived(c, true);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[28px] font-extrabold tracking-tight">{t("title")}</h1>
        <Button onClick={openCreate} className="gap-1.5">
          <Plus className="size-4" />
          {t("add")}
        </Button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={tab} onValueChange={(v) => setTab(v as Type)}>
          <TabsList className="h-11 rounded-full p-1">
            <TabsTrigger value="expense" className="rounded-full px-5">
              {t("expenses")}
            </TabsTrigger>
            <TabsTrigger value="income" className="rounded-full px-5">
              {t("income")}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {archivedCount > 0 && (
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-muted-foreground">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="size-4 accent-[var(--primary)]"
            />
            {t("showArchived")} ({archivedCount})
          </label>
        )}
      </div>

      {visible.length === 0 ? (
        <div className="grid place-items-center gap-3 rounded-3xl border border-dashed bg-card px-6 py-14 text-center">
          <span className="grid size-14 place-items-center rounded-full bg-accent text-accent-foreground">
            <Tag className="size-6" />
          </span>
          <div className="space-y-1">
            <p className="text-lg font-bold">{t("emptyTitle")}</p>
            <p className="text-muted-foreground">{t("emptyHint")}</p>
          </div>
          <Button onClick={openCreate} className="gap-1.5">
            <Plus className="size-4" />
            {t("add")}
          </Button>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((c, i) => {
            const isIncome = c.type === "income";
            return (
              <li
                key={c.id}
                style={{ "--i": Math.min(i, 8) } as React.CSSProperties}
                className={cn(
                  "reveal flex items-center gap-4 rounded-3xl border bg-card p-5 shadow-[var(--shadow-card)] transition-shadow",
                  c.isArchived && "opacity-60",
                )}
              >
                <CategoryBadge icon={c.icon} color={c.color} className="size-12" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{displayName(c)}</p>
                  <p
                    className={cn(
                      "amount text-sm font-semibold",
                      c.total === 0 ? "text-muted-foreground" : isIncome ? "text-income" : "text-expense",
                    )}
                  >
                    {c.total === 0 ? "" : isIncome ? "+" : "−"}
                    {formatMoney(c.total, currency, locale)}
                    <span className="ml-1.5 font-medium text-muted-foreground">· {t("thisMonth")}</span>
                  </p>
                  {c.isArchived && (
                    <span className="mt-1 inline-block rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
                      {t("archived")}
                    </span>
                  )}
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={<Button variant="ghost" size="icon" aria-label={`${t("actions")}: ${displayName(c)}`} />}
                  >
                    <MoreVertical className="size-5" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-44">
                    <DropdownMenuItem onClick={() => openEdit(c)}>
                      <Pencil className="size-4" />
                      {t("edit")}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setArchived(c, !c.isArchived)}>
                      {c.isArchived ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
                      {c.isArchived ? t("restore") : t("archive")}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => openDelete(c)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="size-4" />
                      {t("delete")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </li>
            );
          })}
        </ul>
      )}

      <CategoryFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        category={editing}
        defaultType={tab}
      />

      <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent className="sm:max-w-md">
          {deleting && deleteState === "confirm" && (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl font-extrabold">{t("deleteTitle")}</DialogTitle>
                <DialogDescription>{t("deleteBody", { name: displayName(deleting) })}</DialogDescription>
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
            </>
          )}
          {deleting && deleteState === "hasTransactions" && (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl font-extrabold">{t("hasTransactionsTitle")}</DialogTitle>
                <DialogDescription>{t("hasTransactionsBody")}</DialogDescription>
              </DialogHeader>
              <DialogFooter className="gap-2 sm:gap-2">
                <Button variant="secondary" onClick={() => setDeleting(null)}>
                  {tc("cancel")}
                </Button>
                <Button onClick={archiveInstead}>
                  <Archive className="size-4" />
                  {t("archiveInstead")}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

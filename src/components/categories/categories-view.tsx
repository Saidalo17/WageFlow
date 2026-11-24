"use client";

import {
  Archive,
  ArchiveRestore,
  GripVertical,
  Loader2,
  MoreVertical,
  Pencil,
  Plus,
  Tag,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useLayoutEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { archiveCategory, deleteCategory, reorderCategoryList } from "@/app/(app)/categories/actions";
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

  // ----- Dragging to reorder -----
  // `override` is the order the user just made; it is used while it still describes the same set of categories.
  const [override, setOverride] = useState<{ sig: string; ids: string[] } | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const sig = visible.map((c) => c.id).sort().join(",");
  const byId = new Map(visible.map((c) => [c.id, c]));
  const orderedIds = override && override.sig === sig ? override.ids : visible.map((c) => c.id);
  const items = orderedIds.map((id) => byId.get(id)).filter((c): c is CategoryItem => !!c);

  const listRef = useRef<HTMLUListElement>(null);
  const itemRefs = useRef(new Map<string, HTMLLIElement>());
  const idsRef = useRef(orderedIds);
  const startIds = useRef(orderedIds);
  const drag = useRef<{ id: string; grabX: number; grabY: number; x: number; y: number } | null>(null);
  const focusAfter = useRef<string | null>(null);
  const handlers = useRef<{ move: (e: PointerEvent) => void; up: () => void }>({ move: () => {}, up: () => {} });

  function applyDragOffset() {
    const d = drag.current;
    const li = d && itemRefs.current.get(d.id);
    const ul = listRef.current;
    if (!d || !li || !ul) return;
    const box = ul.getBoundingClientRect();
    // offsetLeft/Top are the item's place in the grid without the drag offset, so the item follows the pointer
    li.style.translate = `${d.x - box.left - d.grabX - li.offsetLeft}px ${d.y - box.top - d.grabY - li.offsetTop}px`;
  }

  useLayoutEffect(() => {
    idsRef.current = orderedIds;
    if (!drag.current) startIds.current = orderedIds;
    applyDragOffset();
    if (focusAfter.current) {
      itemRefs.current.get(focusAfter.current)?.querySelector<HTMLButtonElement>("[data-handle]")?.focus();
      focusAfter.current = null;
    }
  });

  async function saveOrder(ids: string[]) {
    const result = await reorderCategoryList(tab, ids);
    if (!result.ok) {
      toast.error(t(`errors.${result.error}`));
      setOverride(null);
    }
    router.refresh();
  }

  function moveTo(id: string, to: number) {
    const ids = idsRef.current;
    const from = ids.indexOf(id);
    if (from < 0 || to < 0 || to >= ids.length || to === from) return false;
    const next = [...ids];
    next.splice(from, 1);
    next.splice(to, 0, id);
    idsRef.current = next;
    setOverride({ sig, ids: next });
    return true;
  }

  function onHandleDown(e: React.PointerEvent<HTMLButtonElement>, id: string) {
    if (e.button !== 0) return;
    const li = itemRefs.current.get(id);
    if (!li) return;
    const r = li.getBoundingClientRect();
    e.preventDefault();
    startIds.current = idsRef.current;
    drag.current = { id, grabX: e.clientX - r.left, grabY: e.clientY - r.top, x: e.clientX, y: e.clientY };
    setDragId(id);
    // Moving a card in the grid re-inserts its element, which would drop a pointer capture; window listeners do not care
    const move = (ev: PointerEvent) => handlers.current.move(ev);
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      handlers.current.up();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  }

  function onHandleMove(e: PointerEvent) {
    const d = drag.current;
    if (!d) return;
    d.x = e.clientX;
    d.y = e.clientY;
    // The card whose centre is closest to the pointer is the slot the dragged one takes
    let best = -1;
    let bestDist = Infinity;
    idsRef.current.forEach((id, i) => {
      if (id === d.id) return;
      const r = itemRefs.current.get(id)?.getBoundingClientRect();
      if (!r) return;
      const dist = Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2));
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    });
    // The dragged card sits under the pointer, so measure from where its slot is in the grid
    const li = itemRefs.current.get(d.id);
    const ul = listRef.current;
    let myDist = Infinity;
    if (li && ul) {
      const box = ul.getBoundingClientRect();
      myDist = Math.hypot(e.clientX - (box.left + li.offsetLeft + li.offsetWidth / 2), e.clientY - (box.top + li.offsetTop + li.offsetHeight / 2));
    }
    // Only swap when the pointer is clearly nearer to the other card, so cards do not flicker back and forth
    if (best >= 0 && bestDist < myDist * 0.8) moveTo(d.id, best);
    applyDragOffset();
  }

  function onHandleUp() {
    const d = drag.current;
    if (!d) return;
    const li = itemRefs.current.get(d.id);
    if (li) li.style.translate = "";
    const changed = idsRef.current.some((id, i) => id !== startIds.current[i]);
    drag.current = null;
    setDragId(null);
    if (changed) void saveOrder(idsRef.current);
  }

  // The window listeners added when a drag starts call the newest versions of these
  useLayoutEffect(() => {
    handlers.current = { move: onHandleMove, up: onHandleUp };
  });

  function onHandleKey(e: React.KeyboardEvent<HTMLButtonElement>, id: string) {
    const step = e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : 0;
    if (!step) return;
    e.preventDefault();
    const to = idsRef.current.indexOf(id) + step;
    if (moveTo(id, to)) {
      focusAfter.current = id;
      void saveOrder(idsRef.current);
    }
  }

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
        <ul ref={listRef} className="relative grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((c, i) => {
            const isIncome = c.type === "income";
            return (
              <li
                key={c.id}
                ref={(el) => {
                  if (el) itemRefs.current.set(c.id, el);
                  else itemRefs.current.delete(c.id);
                }}
                style={{ "--i": Math.min(i, 8) } as React.CSSProperties}
                className={cn(
                  "reveal flex items-center gap-3 rounded-3xl border bg-card p-5 shadow-[var(--shadow-card)] transition-shadow",
                  c.isArchived && "opacity-60",
                  dragId === c.id && "relative z-20 scale-[1.03] border-primary shadow-2xl",
                )}
              >
                <button
                  type="button"
                  data-handle
                  aria-label={`${t("reorder")}: ${displayName(c)}`}
                  title={t("reorder")}
                  onPointerDown={(e) => onHandleDown(e, c.id)}
                  onKeyDown={(e) => onHandleKey(e, c.id)}
                  className={cn(
                    "-ms-2 grid size-8 shrink-0 touch-none place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                    dragId === c.id ? "cursor-grabbing" : "cursor-grab",
                  )}
                >
                  <GripVertical className="size-5" />
                </button>
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
                    <span className="ms-1.5 font-medium text-muted-foreground">· {t("thisMonth")}</span>
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

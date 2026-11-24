"use client";

import { Search, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useCategoryName } from "@/components/categories/use-category-name";
import { Input } from "@/components/ui/input";
import { RANGES, type Range } from "@/lib/period";
import { cn } from "@/lib/utils";
import type { CategoryOption } from "./types";

type TypeFilter = "all" | "expense" | "income";

export function TransactionFilters({
  range,
  type,
  categoryId,
  q,
  categories,
}: {
  range: Range;
  type: TypeFilter;
  categoryId: string;
  q: string;
  categories: CategoryOption[];
}) {
  const t = useTranslations("transactions.filters");
  const router = useRouter();
  const pathname = usePathname();
  const categoryName = useCategoryName();
  const [search, setSearch] = useState(q);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  /** Updates one URL parameter; changing a filter always goes back to the first page. */
  function update(changes: Record<string, string | null>) {
    // Read the address as it is *now*: the delayed search update must not overwrite a filter chosen in the meantime.
    const next = new URLSearchParams(window.location.search);
    next.delete("limit");
    for (const [k, v] of Object.entries(changes)) {
      if (v === null || v === "") next.delete(k);
      else next.set(k, v);
    }
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  // Search waits for a short pause in typing before it reloads the list.
  useEffect(() => {
    if (search === q) return;
    timer.current = setTimeout(() => update({ q: search.trim() || null }), 350);
    return () => clearTimeout(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const visibleCategories = categories.filter(
    (c) => (type === "all" || c.type === type) && (!c.isArchived || c.id === categoryId),
  );

  const chip = (active: boolean) =>
    cn(
      "h-9 shrink-0 rounded-full border px-4 text-sm font-semibold whitespace-nowrap transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
      active
        ? "border-transparent bg-accent text-accent-foreground"
        : "bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
    );

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 start-4 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("search")}
          aria-label={t("search")}
          className="pe-10 ps-11"
        />
        {search && (
          <button
            type="button"
            onClick={() => {
              setSearch("");
              update({ q: null });
            }}
            aria-label={t("clearSearch")}
            className="absolute inset-y-0 end-0 grid w-11 place-items-center text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label={t("period")}>
        {RANGES.map((r) => (
          <button
            key={r}
            type="button"
            aria-pressed={range === r}
            onClick={() => update({ range: r === "month" ? null : r })}
            className={chip(range === r)}
          >
            {t(`ranges.${r}`)}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-2" role="group" aria-label={t("type")}>
          {(["all", "expense", "income"] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={type === v}
              onClick={() => update({ type: v === "all" ? null : v, category: null })}
              className={chip(type === v)}
            >
              {t(`types.${v}`)}
            </button>
          ))}
        </div>

        <select
          value={categoryId}
          onChange={(e) => update({ category: e.target.value || null })}
          aria-label={t("category")}
          className="h-9 max-w-full min-w-0 rounded-full border bg-card px-4 text-sm font-semibold text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <option value="">{t("allCategories")}</option>
          {visibleCategories.map((c) => (
            <option key={c.id} value={c.id}>
              {categoryName(c)}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

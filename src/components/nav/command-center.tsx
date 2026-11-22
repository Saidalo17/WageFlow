"use client";

import { ArrowDownLeft, ArrowUpRight, Download, FileText, Search, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { searchTransactionsForCommand, type SearchHit } from "@/app/(app)/search/actions";
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { useTransactionModal } from "@/components/transactions/transaction-modal-provider";
import { formatDate } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { NAV_ITEMS, SETTINGS_ITEM } from "./nav-items";

type CategoryLink = { id: string; name: string; systemKey: string | null; type: "income" | "expense"; isArchived: boolean };

/**
 * The command center: one box for pages, quick actions, categories and a live search of transactions.
 * Opens with Ctrl+K / ⌘K or from the search button in the top bar.
 */
export function CommandCenter({
  open,
  onOpenChange,
  categories,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: CategoryLink[];
}) {
  const t = useTranslations("command");
  const tNav = useTranslations("nav");
  const tSys = useTranslations("categories.system");
  const locale = useLocale();
  const router = useRouter();
  const { openAdd } = useTransactionModal();

  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const request = useRef(0);

  // Ctrl+K / ⌘K from anywhere
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  // Live search: waits for a pause in typing; an older answer never replaces a newer one.
  useEffect(() => {
    const q = query.trim();
    const id = ++request.current;
    if (q.length < 2) return;
    const timer = setTimeout(() => {
      void searchTransactionsForCommand(q).then((r) => {
        if (id === request.current) setHits(r);
      });
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  const shownHits = query.trim().length >= 2 ? hits : [];

  const go = (href: string) => {
    onOpenChange(false);
    router.push(href);
  };
  const act = (fn: () => void) => {
    onOpenChange(false);
    // Let the palette close first, so the form that opens takes the focus.
    setTimeout(fn, 60);
  };
  const catName = (c: { name: string; systemKey: string | null }) => (c.systemKey ? tSys(c.systemKey) : c.name);
  const q = query.trim();

  return (
    <CommandDialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) {
          setQuery("");
          setHits([]);
        }
      }}
      title={t("title")}
      description={t("description")}
      className="border bg-popover/97 backdrop-blur-xl sm:max-w-xl"
    >
      <Command className="bg-transparent">
        <CommandInput value={query} onValueChange={setQuery} placeholder={t("placeholder")} />
        <CommandList className="max-h-[min(60vh,420px)]">
          <CommandEmpty>{t("noResults")}</CommandEmpty>

          {q.length >= 2 && (
            <CommandGroup heading={t("transactions")}>
              <CommandItem value={`${q} search`} onSelect={() => go(`/transactions?range=all&q=${encodeURIComponent(q)}`)}>
                <Search className="size-4" />
                {t("searchFor", { q })}
              </CommandItem>
              {shownHits.map((h) => (
                <CommandItem key={h.id} value={`${q} ${h.id}`} onSelect={() => go(`/transactions?range=all&q=${encodeURIComponent(q)}`)}>
                  {h.type === "income" ? <ArrowUpRight className="size-4 text-income" /> : <ArrowDownLeft className="size-4 text-expense" />}
                  <span className="min-w-0 flex-1 truncate">
                    {h.note || (h.categorySystemKey ? tSys(h.categorySystemKey) : h.categoryName)}
                    <span className="ml-2 text-xs text-muted-foreground">{formatDate(h.occurredOn, locale, { day: "numeric", month: "short" })}</span>
                  </span>
                  <span className="amount text-sm font-semibold">
                    {h.type === "income" ? "+" : "−"}
                    {formatMoney(h.amount, h.currency, locale)}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          <CommandGroup heading={t("actions")}>
            <CommandItem value="add expense" onSelect={() => act(() => openAdd("expense"))}>
              <ArrowDownLeft className="size-4 text-expense" />
              {t("addExpense")}
            </CommandItem>
            <CommandItem value="add income" onSelect={() => act(() => openAdd("income"))}>
              <ArrowUpRight className="size-4 text-income" />
              {t("addIncome")}
            </CommandItem>
            <CommandItem value="import statement" onSelect={() => go("/transactions/import")}>
              <Upload className="size-4" />
              {t("importStatement")}
            </CommandItem>
            <CommandItem value="export csv" onSelect={() => go("/api/export")}>
              <Download className="size-4" />
              {t("exportCsv")}
            </CommandItem>
            <CommandItem value="salary report pdf" onSelect={() => go("/salary/report?print=1")}>
              <FileText className="size-4" />
              {t("salaryReport")}
            </CommandItem>
          </CommandGroup>

          <CommandSeparator />
          <CommandGroup heading={t("go")}>
            {[...NAV_ITEMS, SETTINGS_ITEM].map(({ href, key, icon: Icon }) => (
              <CommandItem key={href} value={`go ${tNav(key)}`} onSelect={() => go(href)}>
                <Icon className="size-4" />
                {tNav(key)}
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandSeparator />
          <CommandGroup heading={t("categories")}>
            {categories
              .filter((c) => !c.isArchived)
              .map((c) => (
                <CommandItem key={c.id} value={`category ${catName(c)}`} onSelect={() => go(`/transactions?range=all&category=${c.id}`)}>
                  {c.type === "income" ? <ArrowUpRight className="size-4 text-income" /> : <ArrowDownLeft className="size-4 text-expense" />}
                  {catName(c)}
                </CommandItem>
              ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  );
}

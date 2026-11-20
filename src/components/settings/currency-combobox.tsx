"use client";

import { Check, ChevronsUpDown } from "lucide-react";
import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getCurrencies, POPULAR_CURRENCIES } from "@/lib/currencies";
import { cn } from "@/lib/utils";

/** Plain substring search (cmdk's default also matches scattered letters, which finds unrelated currencies). */
function strictFilter(value: string, search: string, keywords?: string[]) {
  const q = search.trim().toLowerCase();
  if (!q) return 1;
  const haystack = `${value} ${(keywords ?? []).join(" ")}`.toLowerCase();
  if (!haystack.includes(q)) return 0;
  return haystack.startsWith(q) ? 2 : 1; // a code that starts with the text comes first
}

/**
 * Pick any ISO 4217 currency. Search works by code ("EUR") and by name in the interface
 * language ("евро", "euro", "欧元"). Popular currencies are listed first.
 */
export function CurrencyCombobox({
  value,
  onChange,
  id,
  compact = false,
  ariaLabel,
  triggerClassName,
}: {
  value: string;
  onChange: (code: string) => void;
  id?: string;
  /** Narrow button that shows only the code (for use beside an amount field). */
  compact?: boolean;
  ariaLabel?: string;
  triggerClassName?: string;
}) {
  const t = useTranslations("settings.currencyPicker");
  const locale = useLocale();
  const [open, setOpen] = useState(false);

  const all = useMemo(() => getCurrencies(locale), [locale]);
  const popular = POPULAR_CURRENCIES.map((c) => all.find((x) => x.code === c)).filter(
    (x): x is NonNullable<typeof x> => !!x,
  );
  const others = all.filter((c) => !POPULAR_CURRENCIES.includes(c.code));
  const selected = all.find((c) => c.code === value);

  const item = (c: (typeof all)[number]) => (
    <CommandItem
      key={c.code}
      value={`${c.code} ${c.name}`}
      keywords={[c.symbol]}
      onSelect={() => {
        onChange(c.code);
        setOpen(false);
      }}
      data-checked={c.code === value}
    >
      <span className="w-12 shrink-0 font-bold">{c.code}</span>
      <span className="w-8 shrink-0 text-muted-foreground">{c.symbol}</span>
      <span className="min-w-0 flex-1 truncate">{c.name}</span>
      <Check className={cn("size-4", c.code === value ? "opacity-100" : "opacity-0")} />
    </CommandItem>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-label={ariaLabel}
            className={cn(
              "h-12 justify-between rounded-xl px-3.5 text-base font-normal md:text-sm",
              compact ? "h-14 w-28 shrink-0 gap-1 font-bold" : "w-full",
              triggerClassName,
            )}
          />
        }
      >
        <span className="min-w-0 truncate">
          {compact ? (
            value
          ) : selected ? (
            <>
              <span className="font-bold">{selected.code}</span>
              <span className="text-muted-foreground"> · {selected.symbol} · </span>
              {selected.name}
            </>
          ) : (
            value
          )}
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(26rem,calc(100vw-2rem))] p-0">
        <Command filter={strictFilter}>
          <CommandInput placeholder={t("search")} />
          <CommandList className="max-h-72">
            <CommandEmpty>{t("empty")}</CommandEmpty>
            <CommandGroup heading={t("popular")}>{popular.map(item)}</CommandGroup>
            <CommandGroup heading={t("all")}>{others.map(item)}</CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/net-worth", key: "overview" },
  { href: "/accounts", key: "accounts" },
  { href: "/debts", key: "debts" },
] as const;

/** The three pages of the net worth section: overview, accounts, debts. */
export function FinanceTabs() {
  const t = useTranslations("finance.tabs");
  const pathname = usePathname();
  return (
    <nav aria-label={t("label")} className="flex gap-2 overflow-x-auto pb-1">
      {TABS.map(({ href, key }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={key}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex h-10 shrink-0 items-center rounded-full border px-5 text-sm font-semibold whitespace-nowrap transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none sm:h-9",
              active ? "border-transparent bg-accent text-accent-foreground" : "bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {t(key)}
          </Link>
        );
      })}
    </nav>
  );
}

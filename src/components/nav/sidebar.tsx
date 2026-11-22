"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { isNavActive, NAV_ITEMS, SETTINGS_ITEM, type NavItem } from "./nav-items";
import { ThemeSwitch } from "./theme-switch";

/** One menu row. The active one is a glass emerald pill with a soft glow. */
export function NavLink({ item, onNavigate, className }: { item: NavItem; onNavigate?: () => void; className?: string }) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const active = isNavActive(pathname, item.href);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold transition-all focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        active
          ? "border-[color-mix(in_oklab,var(--primary)_40%,transparent)] bg-[color-mix(in_oklab,var(--primary)_16%,transparent)] text-primary-strong shadow-[var(--glow)]"
          : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
        className,
      )}
    >
      <Icon className={cn("size-5 shrink-0 transition-transform group-hover:scale-110", active && "text-primary")} />
      {t(item.key)}
    </Link>
  );
}

/** The desktop sidebar: brand, sections, settings and the theme switch. Phones use the menu sheet instead. */
export function Sidebar() {
  const tApp = useTranslations("app");
  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col gap-2 border-r bg-card/60 p-4 backdrop-blur-xl lg:flex print:hidden">
      <Link href="/" className="mb-4 flex items-center gap-3 px-2 pt-2 text-xl font-extrabold tracking-tight">
        <Image src="/logo.png" alt="" width={40} height={40} className="size-10 rounded-xl object-cover" priority />
        {tApp("name")}
      </Link>

      <nav aria-label={tApp("name")} className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.href} item={item} />
        ))}
      </nav>

      <div className="mt-auto flex flex-col gap-3">
        <div className="mx-2 h-px bg-border" />
        <NavLink item={SETTINGS_ITEM} />
        <ThemeSwitch className="mx-auto" />
      </div>
    </aside>
  );
}

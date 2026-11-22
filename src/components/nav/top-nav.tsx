"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { LogOut, Menu, Plus, Search, Settings } from "lucide-react";
import { UserAvatar } from "@/components/user-avatar";
import { DisplayCurrencySwitcher } from "./display-currency";
import { logoutUser } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useHydrated } from "@/lib/use-hydrated";
import { CommandCenter } from "./command-center";
import { LanguageSwitcher } from "./language-switcher";
import { NAV_ITEMS, SETTINGS_ITEM } from "./nav-items";
import { NavLink } from "./sidebar";
import { ThemeToggle } from "./theme-toggle";
import { useTransactionModal } from "@/components/transactions/transaction-modal-provider";

type NavUser = {
  name: string | null;
  email: string;
  avatarVersion: number | null;
  emoji: string | null;
  accent: string | null;
};

type CategoryLink = { id: string; name: string; systemKey: string | null; type: "income" | "expense"; isArchived: boolean };

export function TopNav({
  user,
  displayCurrency,
  categories,
}: {
  user: NavUser;
  displayCurrency: string;
  categories: CategoryLink[];
}) {
  const t = useTranslations("nav");
  const tApp = useTranslations("app");
  const tActions = useTranslations("actions");
  const tProfile = useTranslations("profile");
  const tCurrency = useTranslations("currencyView");
  const { openAdd } = useTransactionModal();
  const [open, setOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [signingOut, startTransition] = useTransition();

  // "⌘ K" on a Mac, "Ctrl K" elsewhere; the server does not know, so it waits for the browser.
  const hydrated = useHydrated();
  const shortcut = hydrated && /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘ K" : "Ctrl K";

  return (
    <header className="sticky top-0 z-40 border-b bg-background/70 backdrop-blur-xl print:hidden">
      <div className="mx-auto flex h-16 max-w-[1360px] items-center gap-2 px-4 sm:px-6">
        {/* Phones and tablets: the menu is a sheet; on a desktop the sidebar does this job */}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger render={<Button variant="ghost" size="icon" className="lg:hidden" aria-label={t("menu")} />}>
            <Menu className="size-5" />
          </SheetTrigger>
          <SheetContent side="left" className="p-4">
            <SheetTitle className="flex items-center gap-2 text-lg font-extrabold">
              <Image src="/logo.png" alt="" width={28} height={28} className="size-7 rounded-lg object-cover" />
              {tApp("name")}
            </SheetTitle>
            <nav className="mt-2 flex flex-col gap-1">
              {[...NAV_ITEMS, SETTINGS_ITEM].map((item) => (
                <NavLink key={item.href} item={item} onNavigate={() => setOpen(false)} />
              ))}
            </nav>
            {/* On phones the currency choice lives in the menu, so the top bar stays uncrowded */}
            <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-muted px-4 py-3 sm:hidden">
              <span className="text-sm font-semibold">{tCurrency("label")}</span>
              <DisplayCurrencySwitcher value={displayCurrency} />
            </div>
          </SheetContent>
        </Sheet>

        <Link href="/" className="flex items-center gap-2 text-lg font-extrabold tracking-tight lg:hidden">
          <Image src="/logo.png" alt="" width={36} height={36} className="size-9 rounded-xl object-cover" />
          <span className="sr-only sm:not-sr-only">{tApp("name")}</span>
        </Link>

        {/* Command center: search + quick actions */}
        <button
          type="button"
          onClick={() => setCommandOpen(true)}
          aria-label={t("search")}
          className="glass hidden h-11 max-w-md min-w-0 flex-1 items-center gap-3 rounded-full px-4 text-left text-sm text-muted-foreground transition-all hover:border-primary/40 hover:text-foreground hover:shadow-[var(--glow)] focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none md:flex"
        >
          <Search className="size-4 shrink-0" />
          <span className="min-w-0 flex-1 truncate">{t("search")}</span>
          <kbd className="shrink-0 rounded-md border bg-background/60 px-1.5 py-0.5 text-xs font-semibold">{shortcut}</kbd>
        </button>

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <Button variant="ghost" size="icon" className="md:hidden" aria-label={t("search")} onClick={() => setCommandOpen(true)}>
            <Search className="size-5" />
          </Button>
          <Button onClick={() => openAdd()} className="gap-1.5">
            <Plus className="size-4" />
            <span className="hidden sm:inline">{tActions("add")}</span>
            <span className="sr-only sm:hidden">{tActions("add")}</span>
          </Button>
          <DisplayCurrencySwitcher value={displayCurrency} className="hidden sm:block" />
          <LanguageSwitcher />
          <div className="lg:hidden">
            <ThemeToggle />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label={tProfile("label")} />}>
              <UserAvatar {...user} className="size-8 text-sm" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-56">
              <div className="flex items-center gap-3 px-2 py-1.5">
                <UserAvatar {...user} className="size-10" />
                <div className="min-w-0">
                  {user.name && <p className="truncate text-sm font-bold">{user.name}</p>}
                  <p className="truncate text-sm text-muted-foreground">{user.email}</p>
                </div>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem render={<Link href="/settings" />}>
                <Settings className="size-4" />
                {t("settings")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => startTransition(() => logoutUser())} disabled={signingOut}>
                <LogOut className="size-4" />
                {tProfile("logout")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <CommandCenter open={commandOpen} onOpenChange={setCommandOpen} categories={categories} />
    </header>
  );
}

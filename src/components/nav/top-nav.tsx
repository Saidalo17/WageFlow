"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { LogOut, Menu, Plus, Settings, UserRound, Wallet } from "lucide-react";
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
import { useTransactionModal } from "@/components/transactions/transaction-modal-provider";
import { cn } from "@/lib/utils";
import { LanguageSwitcher } from "./language-switcher";
import { ThemeToggle } from "./theme-toggle";

const links = [
  { href: "/", key: "overview" },
  { href: "/transactions", key: "transactions" },
  { href: "/categories", key: "categories" },
  { href: "/analytics", key: "analytics" },
  { href: "/budgets", key: "budgets" },
] as const;

function useIsActive() {
  const pathname = usePathname();
  return (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
}

export function TopNav({ user }: { user: { name: string | null; email: string } }) {
  const t = useTranslations("nav");
  const tApp = useTranslations("app");
  const tActions = useTranslations("actions");
  const tProfile = useTranslations("profile");
  const isActive = useIsActive();
  const { openAdd } = useTransactionModal();
  const [open, setOpen] = useState(false);
  const [signingOut, startTransition] = useTransition();

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1200px] items-center gap-2 px-4 sm:px-6">
        {/* Mobile: burger + sheet */}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger
            render={
              <Button variant="ghost" size="icon" className="min-[1100px]:hidden" aria-label={t("menu")} />
            }
          >
            <Menu className="size-5" />
          </SheetTrigger>
          <SheetContent side="left" className="p-4">
            <SheetTitle className="flex items-center gap-2 text-lg font-extrabold">
              <Wallet className="size-5 text-primary" />
              {tApp("name")}
            </SheetTitle>
            <nav className="mt-2 flex flex-col gap-1">
              {[...links, { href: "/settings", key: "settings" } as const].map(({ href, key }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "rounded-xl px-4 py-3 text-base font-semibold transition-colors",
                    isActive(href)
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {t(key)}
                </Link>
              ))}
            </nav>
          </SheetContent>
        </Sheet>

        <Link href="/" className="flex items-center gap-2 text-lg font-extrabold tracking-tight">
          <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-violet-500 text-white">
            <Wallet className="size-5" />
          </span>
          <span className="hidden sm:inline">{tApp("name")}</span>
        </Link>

        {/* Desktop links */}
        <nav className="ml-4 hidden items-center gap-1 min-[1100px]:flex">
          {links.map(({ href, key }) => (
            <Link
              key={href}
              href={href}
              aria-current={isActive(href) ? "page" : undefined}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-semibold whitespace-nowrap transition-colors",
                isActive(href)
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {t(key)}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <Button onClick={() => openAdd()} className="gap-1.5">
            <Plus className="size-4" />
            <span className="hidden sm:inline">{tActions("add")}</span>
            <span className="sr-only sm:hidden">{tActions("add")}</span>
          </Button>
          <LanguageSwitcher />
          <ThemeToggle />
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="ghost" size="icon" aria-label={tProfile("label")} />}
            >
              <UserRound className="size-5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-56">
              <div className="px-2 py-1.5">
                {user.name && <p className="truncate text-sm font-bold">{user.name}</p>}
                <p className="truncate text-sm text-muted-foreground">{user.email}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem render={<Link href="/settings" />}>
                <Settings className="size-4" />
                {t("settings")}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => startTransition(() => logoutUser())}
                disabled={signingOut}
              >
                <LogOut className="size-4" />
                {tProfile("logout")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}

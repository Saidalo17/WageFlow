import { ArrowLeftRight, BarChart3, Briefcase, Landmark, LayoutDashboard, PiggyBank, Settings, Tags, type LucideIcon } from "lucide-react";

export type NavItem = { href: string; key: string; icon: LucideIcon };

/** The main sections, in the order they are shown in the sidebar and in the phone menu. */
export const NAV_ITEMS: NavItem[] = [
  { href: "/", key: "overview", icon: LayoutDashboard },
  { href: "/transactions", key: "transactions", icon: ArrowLeftRight },
  { href: "/categories", key: "categories", icon: Tags },
  { href: "/analytics", key: "analytics", icon: BarChart3 },
  { href: "/budgets", key: "budgets", icon: PiggyBank },
  { href: "/salary", key: "salary", icon: Briefcase },
  { href: "/net-worth", key: "netWorth", icon: Landmark },
];

export const SETTINGS_ITEM: NavItem = { href: "/settings", key: "settings", icon: Settings };

/** Net worth, accounts and debts are one section with one menu item. */
export function isNavActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  if (href === "/net-worth") return ["/net-worth", "/accounts", "/debts"].some((p) => pathname.startsWith(p));
  return pathname.startsWith(href);
}

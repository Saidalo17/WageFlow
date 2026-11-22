import { Banknote, Home, Landmark, PiggyBank, TrendingUp, Wallet, type LucideIcon } from "lucide-react";
import type { AccountKind } from "@/lib/accounts";

export const KIND_ICON: Record<AccountKind, LucideIcon> = {
  cash: Banknote,
  checking: Landmark,
  savings: PiggyBank,
  investment: TrendingUp,
  property: Home,
  other: Wallet,
};

/**
 * Face of the account "card" for each kind: always a dark surface with light text (so the text contrast does not
 * depend on the theme), tinted with the palette: emerald, navy, gold.
 */
export const KIND_FACE: Record<AccountKind, string> = {
  cash: "bg-[linear-gradient(135deg,#0d7a5f,#0b3b4a)]",
  checking: "bg-[linear-gradient(135deg,#17233b,#0b3b4a)]",
  savings: "bg-[linear-gradient(135deg,#7a5c14,#2a2f3a)]",
  investment: "bg-[linear-gradient(135deg,#0b3b4a,#1f4d8f)]",
  property: "bg-[linear-gradient(135deg,#3d4a2a,#0d5a47)]",
  other: "bg-[linear-gradient(135deg,#2a3346,#17233b)]",
};

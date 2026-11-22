import { ArrowRight, Building2 } from "lucide-react";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Card } from "@/components/card";
import { KIND_ICON } from "@/components/finance/account-kind";
import { buttonVariants } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";
import type { AccountRow } from "@/lib/services/accounts";
import { cn } from "@/lib/utils";

/** The first accounts with their balances, and the net worth underneath. */
export async function AccountsTile({
  accounts,
  netWorth,
  netWorthCurrency,
  index,
  className,
}: {
  accounts: AccountRow[];
  /** Net worth in the user's currency, or null when it could not be worked out. */
  netWorth: number | null;
  netWorthCurrency: string;
  index: number;
  className?: string;
}) {
  const [t, tAcc, locale] = await Promise.all([getTranslations("overview"), getTranslations("accounts"), getLocale()]);
  const shown = accounts.filter((a) => !a.isArchived).slice(0, 4);

  return (
    <Card
      title={t("accountsTitle")}
      index={index}
      className={cn("lift", className)}
      action={
        <Link href="/accounts" className={buttonVariants({ variant: "ghost", size: "sm" })}>
          {t("manage")}
          <ArrowRight className="size-3.5" />
        </Link>
      }
    >
      {shown.length === 0 ? (
        <div className="grid place-items-center gap-3 py-6 text-center">
          <span className="grid size-12 place-items-center rounded-full bg-accent text-accent-foreground">
            <Building2 className="size-5" />
          </span>
          <p className="max-w-[16rem] text-sm text-muted-foreground">{t("accountsEmpty")}</p>
          <Link href="/accounts" className={buttonVariants({ size: "sm" })}>
            {t("addAccount")}
          </Link>
        </div>
      ) : (
        <>
          <ul className="space-y-2">
            {shown.map((a) => {
              const Icon = KIND_ICON[a.kind];
              return (
                <li key={a.id}>
                  <Link
                    href="/accounts"
                    className="flex items-center gap-3 rounded-2xl border bg-muted/40 p-3 transition-all hover:border-primary/40 hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                  >
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground">
                      <Icon className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-bold">{a.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {tAcc(`kinds.${a.kind}`)} · {a.currency}
                      </span>
                    </span>
                    <span className={cn("amount shrink-0 text-right text-sm font-bold", a.balance < 0 && "text-expense")}>{formatMoney(a.balance, a.currency, locale)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
          {netWorth !== null && (
            <Link href="/net-worth" className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-accent px-4 py-3 text-accent-foreground transition-colors hover:bg-accent/80">
              <span className="text-sm font-semibold">{t("netWorthLine")}</span>
              <span className={cn("amount font-extrabold", netWorth < 0 && "text-expense")}>{formatMoney(netWorth, netWorthCurrency, locale)}</span>
            </Link>
          )}
        </>
      )}
    </Card>
  );
}

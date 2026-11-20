"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { setDisplayCurrency } from "@/app/(app)/display-currency/actions";
import { CurrencyCombobox } from "@/components/settings/currency-combobox";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Quick choice of the currency all amounts and chart points are shown in. Only the view changes, not the data. */
export function DisplayCurrencySwitcher({
  value,
  className,
  triggerClassName,
}: {
  value: string;
  className?: string;
  triggerClassName?: string;
}) {
  const t = useTranslations("currencyView");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className={cn(pending && "opacity-60", className)}>
      <CurrencyCombobox
        compact
        value={value}
        ariaLabel={t("label")}
        triggerClassName={cn("h-9 w-auto min-w-16 px-2.5 text-sm", triggerClassName)}
        onChange={(code) =>
          startTransition(async () => {
            await setDisplayCurrency(code);
            router.refresh();
          })
        }
      />
    </div>
  );
}

/** A thin strip shown while amounts are displayed in a currency other than the main one. */
export function DisplayNotice({ currency, main, failed }: { currency: string; main: string; failed: boolean }) {
  const t = useTranslations("currencyView");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  if (!failed && currency === main) return null;

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 pt-4 sm:px-6 sm:pt-6">
      <div
        role="status"
        className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl bg-accent px-4 py-2.5 text-sm text-accent-foreground"
      >
        <p className="min-w-0 flex-1">
          {failed ? t("unavailable", { main }) : t("notice", { currency, main })}
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await setDisplayCurrency(null);
              router.refresh();
            })
          }
        >
          {t("reset", { main })}
        </Button>
      </div>
    </div>
  );
}

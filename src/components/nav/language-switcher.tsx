"use client";

import { Check, Globe } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useMemo, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { setLocale } from "@/i18n/actions";
import type { Locale } from "@/i18n/config";
import { languageOptions } from "@/i18n/language-names";

export function LanguageSwitcher() {
  const t = useTranslations("language");
  const current = useLocale() as Locale;
  const router = useRouter();
  // Names are in the current language and sorted alphabetically in it.
  const options = useMemo(() => languageOptions(current), [current]);
  const [pending, startTransition] = useTransition();

  function choose(locale: Locale) {
    if (locale === current) return;
    startTransition(async () => {
      await setLocale(locale);
      router.refresh();
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" className="gap-1.5 px-3" disabled={pending} />
        }
      >
        <Globe className="size-5" aria-hidden />
        <span className="sr-only">{t("label")}: {current}</span>
        {/* The code is hidden on very narrow phones so the top bar fits in 320px */}
        <span className="hidden text-sm font-bold uppercase min-[380px]:inline" aria-hidden>
          {current}
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-40">
        {options.map(({ code, label }) => (
          <DropdownMenuItem key={code} onClick={() => choose(code)} data-locale={code}>
            <span className="flex-1">{label}</span>
            {code === current && <Check className="size-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

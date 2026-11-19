"use client";

import { AlertTriangle, Loader2, Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { updateProfile } from "@/app/(app)/settings/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { locales, localeLabels, type Locale } from "@/i18n/config";
import { useHydrated } from "@/lib/use-hydrated";
import { cn } from "@/lib/utils";
import { CurrencyCombobox } from "./currency-combobox";

type Props = {
  initial: { name: string; email: string; currency: string; locale: Locale; monthStartDay: number };
};

export function ProfileForm({ initial }: Props) {
  const t = useTranslations("settings");
  const tTheme = useTranslations("theme");
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  // The server does not know the visitor's saved theme, so nothing is shown as chosen until the page is in the browser.
  const hydrated = useHydrated();
  const activeTheme = hydrated ? (theme ?? "system") : null;

  const [name, setName] = useState(initial.name);
  const [locale, setLocale] = useState<Locale>(initial.locale);
  const [currency, setCurrency] = useState(initial.currency);
  const [day, setDay] = useState(initial.monthStartDay);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmCurrency, setConfirmCurrency] = useState(false);

  const err = (key: string) => (errors[key] ? t(`errors.${errors[key]}`) : null);

  async function save() {
    setSaving(true);
    setFormError(null);
    setErrors({});
    const result = await updateProfile({ name, currency, locale, monthStartDay: day });
    setSaving(false);
    if (result.ok) {
      toast.success(t("saved"));
      router.refresh();
    } else if (result.fieldErrors && Object.keys(result.fieldErrors).length > 0) {
      setErrors(result.fieldErrors);
    } else {
      setFormError(result.error);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Changing the currency does not convert old amounts, so ask first.
    if (currency !== initial.currency) setConfirmCurrency(true);
    else void save();
  }

  const themes = [
    { value: "light", label: tTheme("light"), icon: Sun },
    { value: "dark", label: tTheme("dark"), icon: Moon },
    { value: "system", label: tTheme("system"), icon: Monitor },
  ] as const;

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="s-name" className="text-sm font-semibold">
            {t("fields.name")}
          </Label>
          <Input
            id="s-name"
            value={name}
            maxLength={80}
            autoComplete="name"
            onChange={(e) => setName(e.target.value)}
            aria-invalid={!!errors.name}
          />
          {err("name") && (
            <p role="alert" className="text-sm text-destructive">
              {err("name")}
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="s-email" className="text-sm font-semibold">
            {t("fields.email")}
          </Label>
          <Input id="s-email" value={initial.email} readOnly disabled />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="s-locale" className="text-sm font-semibold">
            {t("fields.language")}
          </Label>
          <NativeSelect id="s-locale" value={locale} onChange={(e) => setLocale(e.target.value as Locale)}>
            {locales.map((l) => (
              <option key={l} value={l} lang={l}>
                {localeLabels[l]}
              </option>
            ))}
          </NativeSelect>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="s-currency" className="text-sm font-semibold">
            {t("fields.currency")}
          </Label>
          <CurrencyCombobox id="s-currency" value={currency} onChange={setCurrency} />
          {err("currency") && (
            <p role="alert" className="text-sm text-destructive">
              {err("currency")}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="s-day" className="text-sm font-semibold">
            {t("fields.monthStart")}
          </Label>
          <NativeSelect id="s-day" value={day} onChange={(e) => setDay(Number(e.target.value))}>
            {Array.from({ length: 28 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </NativeSelect>
          <p className="text-sm text-muted-foreground">{t("fields.monthStartHint")}</p>
        </div>

        <fieldset className="space-y-1.5">
          <legend className="text-sm font-semibold">{t("fields.theme")}</legend>
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1" role="radiogroup" aria-label={t("fields.theme")}>
            {themes.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={activeTheme === value}
                onClick={() => setTheme(value)}
                className={cn(
                  "flex h-10 items-center justify-center gap-1.5 rounded-lg text-sm font-semibold transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                  activeTheme === value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-4" />
                <span className="truncate">{label}</span>
              </button>
            ))}
          </div>
        </fieldset>
      </div>

      {formError && (
        <p role="alert" className="rounded-xl bg-expense-bg px-4 py-3 text-sm font-medium text-expense">
          {t(`errors.${formError}`)}
        </p>
      )}

      <div className="flex justify-end">
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="size-4 animate-spin" />}
          {t("save")}
        </Button>
      </div>

      <Dialog open={confirmCurrency} onOpenChange={setConfirmCurrency}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-extrabold">{t("currencyChange.title")}</DialogTitle>
          </DialogHeader>
          <div className="flex gap-3 rounded-2xl bg-warning/15 p-4 text-sm text-foreground">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning" />
            <DialogDescription className="text-foreground">{t("currencyChange.body")}</DialogDescription>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="secondary" onClick={() => setConfirmCurrency(false)}>
              {t("cancel")}
            </Button>
            <Button
              type="button"
              onClick={() => {
                setConfirmCurrency(false);
                void save();
              }}
            >
              {t("currencyChange.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  );
}

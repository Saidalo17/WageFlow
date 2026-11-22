"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { updateCountry } from "@/app/(app)/settings/actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { countryOptions } from "@/lib/tax-countries";

/** Which country's tax rules the salary calculator starts with. */
export function CountryForm({ initial, currency }: { initial: string; currency: string }) {
  const t = useTranslations("settings");
  const tTax = useTranslations("salary.tax");
  const locale = useLocale();
  const router = useRouter();
  const options = useMemo(() => countryOptions(locale), [locale]);
  const [country, setCountry] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  const selected = options.find((o) => o.code === country);
  const mismatch = !!selected && selected.currency !== currency;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(false);
    const result = await updateCountry(country);
    setSaving(false);
    if (result.ok) {
      toast.success(t("saved"));
      router.refresh();
    } else {
      setError(true);
    }
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="s-country" className="text-sm font-semibold">
          {t("fields.country")}
        </Label>
        <NativeSelect id="s-country" value={country} onChange={(e) => setCountry(e.target.value)}>
          <option value="">{tTax("none")}</option>
          {options.map((o) => (
            <option key={o.code} value={o.code}>
              {o.name} · {o.currency}
            </option>
          ))}
        </NativeSelect>
        <p className="text-sm text-muted-foreground">{t("countryHint")}</p>
        {mismatch && (
          <p role="status" className="text-sm font-medium text-warning">
            {tTax("currencyMismatch", { country: selected.name, currency: selected.currency, yours: currency })}
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {t("errors.generic")}
          </p>
        )}
      </div>
      <Button type="submit" disabled={saving || country === initial} className="gap-1.5">
        {saving && <Loader2 className="size-4 animate-spin" />}
        {t("save")}
      </Button>
    </form>
  );
}

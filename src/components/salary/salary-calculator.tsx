"use client";

import { Loader2, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { saveSalaryRecord } from "@/app/(app)/salary/actions";
import { AmountInput } from "@/components/amount-input";
import { Card } from "@/components/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { formatMoney, parseAmount } from "@/lib/money";
import { currencySymbol, parseMinorAmount } from "@/lib/money-input";
import {
  DEFAULT_DAY_HOURS,
  DEFAULT_MONTH_HOURS,
  DEFAULT_OVERTIME_MULTIPLIER,
  SALARY_MODES,
  type Deduction,
  type SalaryMode,
} from "@/lib/salary";
import { calculateWithTaxes } from "@/lib/salary-tax";
import { isTaxCountry, taxYear } from "@/lib/tax";
import { countryOptions } from "@/lib/tax-countries";
import { useToday } from "@/lib/use-today";
import { cn } from "@/lib/utils";

type BonusRow = { key: string; label: string; amount: string };
type DeductionRow = { key: string; label: string; kind: "percent" | "fixed"; value: string };

const MULTIPLIERS = [100, 125, 150, 175, 200, 250, 300];

/** "172,5" -> 17250 (hundredths). Empty = 0, unreadable = null. */
function parseHundredths(text: string, locale: string): number | null {
  if (!text.trim()) return 0;
  const n = parseAmount(text, locale);
  if (n === null || n < 0) return null;
  const h = Math.round(n * 100);
  return Math.abs(n * 100 - h) > 1e-6 ? null : h;
}

export function SalaryCalculator({ currency, defaultCountry }: { currency: string; defaultCountry: string | null }) {
  const t = useTranslations("salary");
  const locale = useLocale();
  const router = useRouter();
  const uid = useId();
  const { today } = useToday();

  const [mode, setMode] = useState<SalaryMode>("monthly");
  const [rateText, setRateText] = useState("");
  const [quantityText, setQuantityText] = useState("");
  const [monthHoursText, setMonthHoursText] = useState(String(DEFAULT_MONTH_HOURS / 100));
  const [dayHoursText, setDayHoursText] = useState(String(DEFAULT_DAY_HOURS / 100));
  const [overtimeText, setOvertimeText] = useState("");
  const [multiplier, setMultiplier] = useState(DEFAULT_OVERTIME_MULTIPLIER);
  const [bonuses, setBonuses] = useState<BonusRow[]>([]);
  const [deductions, setDeductions] = useState<DeductionRow[]>([]);
  const [payDateInput, setPayDateInput] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [addToIncome, setAddToIncome] = useState(true);
  const [country, setCountry] = useState(defaultCountry ?? "");
  const countries = useMemo(() => countryOptions(locale), [locale]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const payDate = payDateInput ?? today;
  const money = (minor: number) => formatMoney(minor, currency, locale);
  const err = (key: string) => (errors[key] ? t(`errors.${errors[key]}`) : null);
  const counter = useRef(0);
  const newKey = () => `${uid}-${counter.current++}`;

  /** What the form says right now. Unreadable or empty fields count as zero, so the result updates while typing. */
  const live = useMemo(() => {
    const minor = (text: string) => {
      const r = parseMinorAmount(text, locale, currency);
      return r.ok ? r.minor : 0;
    };
    const hundredths = (text: string) => parseHundredths(text, locale) ?? 0;
    const ded: Deduction[] = deductions
      .map((d) => {
        if (d.kind === "percent") {
          const n = parseAmount(d.value, locale);
          return { label: d.label, kind: "percent" as const, value: n && n > 0 ? Math.round(n * 100) : 0 };
        }
        return { label: d.label, kind: "fixed" as const, value: minor(d.value) };
      })
      .filter((d) => d.value > 0);
    return calculateWithTaxes(
      {
      mode,
      rate: minor(rateText),
      quantity: hundredths(quantityText),
      monthHours: hundredths(monthHoursText),
      dayHours: hundredths(dayHoursText),
      overtimeHours: hundredths(overtimeText),
      overtimeMultiplier: multiplier,
      bonuses: bonuses.map((b) => minor(b.amount)).filter((a) => a > 0),
      deductions: ded,
      },
      isTaxCountry(country) ? country : null,
      currency,
    );
  }, [country, mode, rateText, quantityText, monthHoursText, dayHoursText, overtimeText, multiplier, bonuses, deductions, locale, currency]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const next: Record<string, string> = {};

    const rate = parseMinorAmount(rateText, locale, currency);
    if (!rate.ok) next.rate = rate.error;

    const quantity = mode === "monthly" ? 0 : parseHundredths(quantityText, locale);
    if (quantity === null || (mode !== "monthly" && quantity <= 0)) next.quantity = "numberInvalid";
    const monthHours = parseHundredths(monthHoursText, locale);
    if (!monthHours) next.monthHours = "numberInvalid";
    const dayHours = parseHundredths(dayHoursText, locale);
    if (!dayHours) next.dayHours = "numberInvalid";
    const overtimeHours = parseHundredths(overtimeText, locale);
    if (overtimeHours === null) next.overtimeHours = "numberInvalid";

    const bonusList: { label: string; amount: number }[] = [];
    for (const b of bonuses) {
      if (!b.label.trim() && !b.amount.trim()) continue; // an untouched row is ignored
      const a = parseMinorAmount(b.amount, locale, currency);
      if (!b.label.trim()) next.bonuses = "labelRequired";
      else if (!a.ok) next.bonuses = a.error;
      else bonusList.push({ label: b.label.trim(), amount: a.minor });
    }

    const deductionList: Deduction[] = [];
    for (const d of deductions) {
      if (!d.label.trim() && !d.value.trim()) continue;
      if (!d.label.trim()) {
        next.deductions = "labelRequired";
        continue;
      }
      if (d.kind === "percent") {
        const n = parseAmount(d.value, locale);
        const v = n === null ? 0 : Math.round(n * 100);
        if (n === null || v <= 0) next.deductions = "numberInvalid";
        else if (v > 10000) next.deductions = "percentTooLarge";
        else deductionList.push({ label: d.label.trim(), kind: "percent", value: v });
      } else {
        const a = parseMinorAmount(d.value, locale, currency);
        if (!a.ok) next.deductions = a.error;
        else deductionList.push({ label: d.label.trim(), kind: "fixed", value: a.minor });
      }
    }
    if (!payDate) next.payDate = "dateInvalid";

    setErrors(next);
    if (
      Object.keys(next).length > 0 ||
      !rate.ok ||
      quantity === null ||
      monthHours === null ||
      dayHours === null ||
      overtimeHours === null
    ) {
      return;
    }

    setSaving(true);
    const result = await saveSalaryRecord({
      mode,
      rate: rate.minor,
      quantity,
      monthHours,
      dayHours,
      overtimeHours,
      overtimeMultiplier: multiplier,
      bonuses: bonusList,
      deductions: deductionList,
      country: isTaxCountry(country) ? country : null,
      payDate,
      title,
      addToIncome,
    });
    setSaving(false);

    if (result.ok) {
      toast.success(t("toasts.saved"));
      setRateText("");
      setQuantityText("");
      setOvertimeText("");
      setBonuses([]);
      setDeductions([]);
      setTitle("");
      setErrors({});
      router.refresh();
    } else if (result.fieldErrors && Object.keys(result.fieldErrors).length > 0) {
      setErrors(result.fieldErrors);
    } else {
      setFormError(result.error);
    }
  }

  const symbol = currencySymbol(locale, currency);
  const showQuantity = mode !== "monthly";
  const fieldError = (key: string, id: string) =>
    err(key) && (
      <p id={id} role="alert" className="text-sm text-destructive">
        {err(key)}
      </p>
    );

  return (
    <Card title={t("calcTitle")} index={2}>
      <form onSubmit={submit} noValidate className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          {/* Pay type */}
          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold">{t("mode")}</legend>
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={t("mode")}>
              {SALARY_MODES.map((m) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={mode === m}
                  onClick={() => setMode(m)}
                  className={cn(
                    "rounded-2xl border px-3 py-2.5 text-sm font-semibold transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                    mode === m && "border-primary bg-accent text-accent-foreground",
                  )}
                >
                  {t(`modes.${m}`)}
                </button>
              ))}
            </div>
          </fieldset>

          <div className={cn("grid gap-4", showQuantity && "sm:grid-cols-2")}>
            <div className="space-y-1.5">
              <Label htmlFor={`${uid}-rate`} className="text-sm font-semibold">
                {t(`rate.${mode}`)}
              </Label>
              <div className="relative">
                <AmountInput
                  id={`${uid}-rate`}
                  placeholder="0"
                  currency={currency}
                  value={rateText}
                  onValueChange={setRateText}
                  aria-invalid={!!errors.rate}
                  aria-describedby={errors.rate ? `${uid}-rate-err` : undefined}
                  className="amount h-14 pr-14 text-2xl font-extrabold"
                />
                <span className="pointer-events-none absolute inset-y-0 right-4 grid place-items-center text-lg font-bold text-muted-foreground">
                  {symbol}
                </span>
              </div>
              {fieldError("rate", `${uid}-rate-err`)}
            </div>

            {showQuantity && (
              <div className="space-y-1.5">
                <Label htmlFor={`${uid}-qty`} className="text-sm font-semibold">
                  {t(`quantity.${mode}`)}
                </Label>
                <Input
                  id={`${uid}-qty`}
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="0"
                  value={quantityText}
                  onChange={(e) => setQuantityText(e.target.value)}
                  aria-invalid={!!errors.quantity}
                  aria-describedby={errors.quantity ? `${uid}-qty-err` : undefined}
                  className="amount h-14 text-2xl font-extrabold"
                />
                {fieldError("quantity", `${uid}-qty-err`)}
              </div>
            )}
          </div>

          {/* Standard hours: they decide what an hour (and so overtime) is worth */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={`${uid}-mh`} className="text-sm font-semibold">
                {t("monthHours")}
              </Label>
              <Input
                id={`${uid}-mh`}
                inputMode="decimal"
                autoComplete="off"
                value={monthHoursText}
                onChange={(e) => setMonthHoursText(e.target.value)}
                aria-invalid={!!errors.monthHours}
                className="amount"
              />
              {fieldError("monthHours", `${uid}-mh-err`)}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${uid}-dh`} className="text-sm font-semibold">
                {t("dayHours")}
              </Label>
              <Input
                id={`${uid}-dh`}
                inputMode="decimal"
                autoComplete="off"
                value={dayHoursText}
                onChange={(e) => setDayHoursText(e.target.value)}
                aria-invalid={!!errors.dayHours}
                className="amount"
              />
              {fieldError("dayHours", `${uid}-dh-err`)}
            </div>
          </div>

          {/* Overtime */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={`${uid}-ot`} className="text-sm font-semibold">
                {t("overtimeHours")}
              </Label>
              <Input
                id={`${uid}-ot`}
                inputMode="decimal"
                autoComplete="off"
                placeholder="0"
                value={overtimeText}
                onChange={(e) => setOvertimeText(e.target.value)}
                aria-invalid={!!errors.overtimeHours}
                className="amount"
              />
              {fieldError("overtimeHours", `${uid}-ot-err`)}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${uid}-om`} className="text-sm font-semibold">
                {t("overtimeMultiplier")}
              </Label>
              <NativeSelect
                id={`${uid}-om`}
                value={multiplier}
                onChange={(e) => setMultiplier(Number(e.target.value))}
              >
                {MULTIPLIERS.map((m) => (
                  <option key={m} value={m}>
                    ×{(m / 100).toLocaleString(locale)}
                  </option>
                ))}
              </NativeSelect>
            </div>
          </div>

          {/* Bonuses */}
          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold">{t("bonuses")}</legend>
            {bonuses.map((b) => (
              <div key={b.key} className="flex items-start gap-2">
                <Input
                  aria-label={t("itemName")}
                  placeholder={t("bonusPlaceholder")}
                  value={b.label}
                  maxLength={60}
                  onChange={(e) =>
                    setBonuses((rows) => rows.map((r) => (r.key === b.key ? { ...r, label: e.target.value } : r)))
                  }
                  className="min-w-0 flex-1"
                />
                <AmountInput
                  aria-label={t("itemAmount")}
                  placeholder="0"
                  currency={currency}
                  value={b.amount}
                  onValueChange={(v) =>
                    setBonuses((rows) => rows.map((r) => (r.key === b.key ? { ...r, amount: v } : r)))
                  }
                  className="amount w-36"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={t("remove")}
                  onClick={() => setBonuses((rows) => rows.filter((r) => r.key !== b.key))}
                >
                  <X className="size-4" />
                </Button>
              </div>
            ))}
            {fieldError("bonuses", `${uid}-b-err`)}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="gap-1.5 max-sm:h-10"
              onClick={() => setBonuses((rows) => [...rows, { key: newKey(), label: "", amount: "" }])}
            >
              <Plus className="size-4" />
              {t("addBonus")}
            </Button>
          </fieldset>

          {/* Country: automatic taxes and contributions */}
          <div className="space-y-1.5">
            <Label htmlFor={`${uid}-country`} className="text-sm font-semibold">
              {t("tax.country")}
            </Label>
            <NativeSelect id={`${uid}-country`} value={country} onChange={(e) => setCountry(e.target.value)}>
              <option value="">{t("tax.none")}</option>
              {countries.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name} · {c.currency}
                </option>
              ))}
            </NativeSelect>
            {live.currencyMismatch && isTaxCountry(country) ? (
              <p role="status" className="text-sm font-medium text-warning">
                {t("tax.currencyMismatch", {
                  country: countries.find((c) => c.code === country)?.name ?? country,
                  currency: countries.find((c) => c.code === country)?.currency ?? "",
                  yours: currency,
                })}
              </p>
            ) : isTaxCountry(country) ? (
              <p className="text-sm text-muted-foreground">{t("tax.disclaimer", { year: taxYear(country) })}</p>
            ) : (
              <p className="text-sm text-muted-foreground">{t("tax.noneHint")}</p>
            )}
          </div>

          {/* Deductions */}
          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold">{t("deductions")}</legend>
            <p className="text-sm text-muted-foreground">{t("deductionsHint")}</p>
            {deductions.map((d) => (
              <div key={d.key} className="flex flex-wrap items-start gap-2 sm:flex-nowrap">
                <Input
                  aria-label={t("itemName")}
                  placeholder={t("deductionPlaceholder")}
                  value={d.label}
                  maxLength={60}
                  onChange={(e) =>
                    setDeductions((rows) => rows.map((r) => (r.key === d.key ? { ...r, label: e.target.value } : r)))
                  }
                  className="min-w-0 flex-1 basis-full sm:basis-auto"
                />
                <div className="w-48 shrink-0">
                  <NativeSelect
                    aria-label={t("deductionKind")}
                    value={d.kind}
                    onChange={(e) =>
                      setDeductions((rows) =>
                        rows.map((r) =>
                          r.key === d.key ? { ...r, kind: e.target.value as "percent" | "fixed", value: "" } : r,
                        ),
                      )
                    }
                  >
                    <option value="percent">{t("kindPercent")}</option>
                    <option value="fixed">{t("kindFixed")}</option>
                  </NativeSelect>
                </div>
                {d.kind === "fixed" ? (
                  <AmountInput
                    aria-label={t("itemAmount")}
                    placeholder="0"
                    currency={currency}
                    value={d.value}
                    onValueChange={(v) =>
                      setDeductions((rows) => rows.map((r) => (r.key === d.key ? { ...r, value: v } : r)))
                    }
                    className="amount w-32"
                  />
                ) : (
                  <Input
                    aria-label={t("itemAmount")}
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder="13"
                    value={d.value}
                    onChange={(e) =>
                      setDeductions((rows) => rows.map((r) => (r.key === d.key ? { ...r, value: e.target.value } : r)))
                    }
                    className="amount w-32"
                  />
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={t("remove")}
                  onClick={() => setDeductions((rows) => rows.filter((r) => r.key !== d.key))}
                >
                  <X className="size-4" />
                </Button>
              </div>
            ))}
            {fieldError("deductions", `${uid}-d-err`)}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="gap-1.5 max-sm:h-10"
              onClick={() =>
                setDeductions((rows) => [...rows, { key: newKey(), label: "", kind: "percent", value: "" }])
              }
            >
              <Plus className="size-4" />
              {t("addDeduction")}
            </Button>
          </fieldset>

          {/* Save details */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={`${uid}-date`} className="text-sm font-semibold">
                {t("payDate")}
              </Label>
              <Input
                id={`${uid}-date`}
                type="date"
                value={payDate}
                onChange={(e) => setPayDateInput(e.target.value)}
                aria-invalid={!!errors.payDate}
              />
              {fieldError("payDate", `${uid}-date-err`)}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${uid}-title`} className="text-sm font-semibold">
                {t("titleField")}
              </Label>
              <Input
                id={`${uid}-title`}
                value={title}
                maxLength={80}
                placeholder={t("titlePlaceholder")}
                onChange={(e) => setTitle(e.target.value)}
              />
              {fieldError("title", `${uid}-title-err`)}
            </div>
          </div>

          <label className="flex items-center gap-3 text-sm font-medium">
            <input
              type="checkbox"
              checked={addToIncome}
              onChange={(e) => setAddToIncome(e.target.checked)}
              className="size-5 rounded accent-[var(--primary)]"
            />
            {t("addToIncome")}
          </label>
        </div>

        {/* Live result */}
        <aside aria-live="polite" className="h-fit space-y-4 rounded-2xl bg-muted p-5 lg:sticky lg:top-24">
          <h3 className="font-bold">{t("resultTitle")}</h3>
          <dl className="amount space-y-2 text-sm">
            <Row label={t("basePay")} value={money(live.result.basePay)} />
            {live.result.overtimePay > 0 && <Row label={t("overtimePay")} value={money(live.result.overtimePay)} />}
            {live.result.bonusTotal > 0 && <Row label={t("bonusTotal")} value={money(live.result.bonusTotal)} />}
            <Row label={t("gross")} value={money(live.result.gross)} strong />
            {/* Taxes from the country rules come first (named by key), then the hand-entered deductions */}
            {live.result.deductions
              .filter((d) => d.amount > 0)
              .map((d, i) => (
                <Row
                  key={i}
                  label={i < live.taxes.length ? t(`tax.items.${d.label}`) : d.label || t("deductions")}
                  value={`−${money(d.amount)}`}
                  muted
                />
              ))}
            <div className="border-t pt-3">
              <Row label={t("net")} value={money(live.result.net)} big />
            </div>
          </dl>
          <dl className="amount space-y-1 border-t pt-3 text-xs text-muted-foreground">
            <Row label={t("hourlyEquivalent")} value={money(live.result.hourlyRate)} />
            <Row label={t("dailyEquivalent")} value={money(live.result.dailyRate)} />
          </dl>

          {formError && (
            <p role="alert" className="rounded-xl bg-expense-bg px-3 py-2 text-sm font-medium text-expense">
              {t(`errors.${formError}`)}
            </p>
          )}
          <Button type="submit" disabled={saving} className="w-full gap-1.5">
            {saving && <Loader2 className="size-4 animate-spin" />}
            {t("save")}
          </Button>
        </aside>
      </form>
    </Card>
  );
}

function Row({
  label,
  value,
  strong,
  big,
  muted,
}: {
  label: string;
  value: string;
  strong?: boolean;
  big?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className={cn(muted && "text-muted-foreground", big && "text-base font-bold")}>{label}</dt>
      <dd className={cn("text-right", strong && "font-bold", big && "text-xl font-extrabold", muted && "text-muted-foreground")}>
        {value}
      </dd>
    </div>
  );
}

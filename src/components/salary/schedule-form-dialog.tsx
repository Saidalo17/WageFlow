"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { saveSchedule } from "@/app/(app)/salary/schedule-actions";
import { AmountInput } from "@/components/amount-input";
import { ResponsiveModal } from "@/components/responsive-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { currencySymbol, editableAmount, formatAmountInput, parseMinorAmount } from "@/lib/money-input";
import { FREQUENCIES, type Frequency } from "@/lib/salary-schedule";
import type { ScheduleRow } from "@/lib/services/schedules";
import { cn } from "@/lib/utils";

const REMIND_OPTIONS = [0, 1, 2, 3, 5, 7, 14];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Schedule being edited, or null to create a new one. */
  schedule: ScheduleRow | null;
  currency: string;
  /** Net pay of the latest saved calculation, offered as the expected amount for a new schedule. */
  suggestedNet: number | null;
  /** Today in the browser's time zone, the default for the "pay date" field. */
  today: string;
};

export function ScheduleFormDialog(props: Props) {
  const t = useTranslations("salary.schedule");
  return (
    <ResponsiveModal
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={t(props.schedule ? "editTitle" : "newTitle")}
    >
      <ScheduleForm key={props.schedule?.id ?? "new"} {...props} onDone={() => props.onOpenChange(false)} />
    </ResponsiveModal>
  );
}

function ScheduleForm({
  schedule,
  currency,
  suggestedNet,
  today,
  onDone,
}: Props & { onDone: () => void }) {
  const t = useTranslations("salary.schedule");
  const locale = useLocale();
  const router = useRouter();
  // Editing keeps the currency the schedule was made in; new ones use the main currency.
  const cur = schedule?.currency ?? currency;

  const [title, setTitle] = useState(schedule?.title ?? t("defaultName"));
  const [amount, setAmount] = useState(
    schedule
      ? formatAmountInput(editableAmount(schedule.expectedNet, cur, locale), cur)
      : suggestedNet
        ? formatAmountInput(editableAmount(suggestedNet, cur, locale), cur)
        : "",
  );
  const [frequency, setFrequency] = useState<Frequency>(schedule?.frequency ?? "monthly");
  const [day, setDay] = useState(String(schedule?.dayOfMonth ?? 1));
  const [anchor, setAnchor] = useState(schedule?.anchorDate ?? today);
  const [remind, setRemind] = useState(schedule?.remindDaysBefore ?? 1);
  const [active, setActive] = useState(schedule?.isActive ?? true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const err = (key: string) => (errors[key] ? t(`errors.${errors[key]}`) : null);
  const fieldError = (key: string) =>
    err(key) && (
      <p role="alert" className="text-sm text-destructive">
        {err(key)}
      </p>
    );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const next: Record<string, string> = {};
    const net = parseMinorAmount(amount, locale, cur);
    if (!net.ok) next.expectedNet = net.error;
    const dayNum = Number(day);
    if (frequency === "monthly" && (!Number.isInteger(dayNum) || dayNum < 1 || dayNum > 31)) next.dayOfMonth = "dayInvalid";
    if (frequency !== "monthly" && !anchor) next.anchorDate = "anchorRequired";
    if (!title.trim()) next.title = "titleRequired";
    setErrors(next);
    if (Object.keys(next).length > 0 || !net.ok) return;

    setSaving(true);
    const result = await saveSchedule(schedule?.id ?? null, {
      title,
      frequency,
      dayOfMonth: frequency === "monthly" ? dayNum : 1,
      anchorDate: frequency === "monthly" ? "" : anchor,
      expectedNet: net.minor,
      remindDaysBefore: remind,
      isActive: active,
    });
    setSaving(false);

    if (result.ok) {
      toast.success(t("toasts.saved"));
      onDone();
      router.refresh();
    } else if (result.fieldErrors && Object.keys(result.fieldErrors).length > 0) {
      setErrors(result.fieldErrors);
    } else {
      setFormError(result.error);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="sch-title" className="text-sm font-semibold">
          {t("name")}
        </Label>
        <Input
          id="sch-title"
          value={title}
          maxLength={60}
          placeholder={t("namePlaceholder")}
          onChange={(e) => setTitle(e.target.value)}
          aria-invalid={!!errors.title}
        />
        {fieldError("title")}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="sch-amount" className="text-sm font-semibold">
          {t("expected")}
        </Label>
        <div className="relative">
          <AmountInput
            id="sch-amount"
            placeholder="0"
            currency={cur}
            value={amount}
            onValueChange={setAmount}
            aria-invalid={!!errors.expectedNet}
            className="amount h-14 pr-14 text-2xl font-extrabold"
          />
          <span className="pointer-events-none absolute inset-y-0 right-4 grid place-items-center text-lg font-bold text-muted-foreground">
            {currencySymbol(locale, cur)}
          </span>
        </div>
        {fieldError("expectedNet")}
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold">{t("frequency")}</legend>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={t("frequency")}>
          {FREQUENCIES.map((f) => (
            <button
              key={f}
              type="button"
              role="radio"
              aria-checked={frequency === f}
              onClick={() => setFrequency(f)}
              className={cn(
                "rounded-2xl border px-2 py-2.5 text-sm font-semibold transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                frequency === f && "border-primary bg-accent text-accent-foreground",
              )}
            >
              {t(`freq.${f}`)}
            </button>
          ))}
        </div>
      </fieldset>

      {frequency === "monthly" ? (
        <div className="space-y-1.5">
          <Label htmlFor="sch-day" className="text-sm font-semibold">
            {t("day")}
          </Label>
          <Input
            id="sch-day"
            type="number"
            inputMode="numeric"
            min={1}
            max={31}
            value={day}
            onChange={(e) => setDay(e.target.value)}
            aria-invalid={!!errors.dayOfMonth}
            className="amount w-28"
          />
          <p className="text-sm text-muted-foreground">{t("dayHint")}</p>
          {fieldError("dayOfMonth")}
        </div>
      ) : (
        <div className="space-y-1.5">
          <Label htmlFor="sch-anchor" className="text-sm font-semibold">
            {t("anchor")}
          </Label>
          <Input
            id="sch-anchor"
            type="date"
            value={anchor}
            onChange={(e) => setAnchor(e.target.value)}
            aria-invalid={!!errors.anchorDate}
            className="w-48"
          />
          <p className="text-sm text-muted-foreground">{t("anchorHint")}</p>
          {fieldError("anchorDate")}
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="sch-remind" className="text-sm font-semibold">
          {t("remind")}
        </Label>
        <NativeSelect id="sch-remind" value={remind} onChange={(e) => setRemind(Number(e.target.value))}>
          {REMIND_OPTIONS.map((n) => (
            <option key={n} value={n}>
              {n === 0 ? t("remind0") : n === 1 ? t("remind1") : t("remindN", { count: n })}
            </option>
          ))}
        </NativeSelect>
        {fieldError("remindDaysBefore")}
      </div>

      <label className="flex items-center gap-3 text-sm font-medium">
        <input
          type="checkbox"
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
          className="size-5 rounded accent-[var(--primary)]"
        />
        {t("active")}
      </label>

      {formError && (
        <p role="alert" className="rounded-xl bg-expense-bg px-4 py-3 text-sm font-medium text-expense">
          {t(`errors.${formError}`)}
        </p>
      )}
      <Button type="submit" disabled={saving} className="w-full gap-1.5">
        {saving && <Loader2 className="size-4 animate-spin" />}
        {t("save")}
      </Button>
    </form>
  );
}

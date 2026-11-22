"use client";

import { CircleDollarSign, CreditCard, Handshake, Home, Landmark, Loader2, MoreVertical, Pencil, Plus, ReceiptText, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { addDebtPayment, removeDebt, removeDebtPayment, saveDebt } from "@/app/(app)/debts/actions";
import { AmountInput } from "@/components/amount-input";
import { Card } from "@/components/card";
import { ResponsiveModal } from "@/components/responsive-modal";
import { CurrencyCombobox } from "@/components/settings/currency-combobox";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { DEBT_DIRECTIONS, DEBT_KINDS, nextPaymentDate, payoff, progress, remaining, type DebtDirection, type DebtKind } from "@/lib/debts";
import { formatDate } from "@/lib/format";
import { formatMoney, parseAmount } from "@/lib/money";
import { currencySymbol, editableAmount, formatAmountInput, parseMinorAmount } from "@/lib/money-input";
import type { DebtRow, PaymentRow } from "@/lib/services/debts";
import { useToday } from "@/lib/use-today";
import { cn } from "@/lib/utils";

const KIND_ICON: Record<DebtKind, typeof Landmark> = {
  loan: Landmark,
  credit_card: CreditCard,
  mortgage: Home,
  personal: Handshake,
  other: CircleDollarSign,
};

export function DebtsView({ debts, payments, currency }: { debts: DebtRow[]; payments: PaymentRow[]; currency: string }) {
  const t = useTranslations("debts");
  const locale = useLocale();
  const router = useRouter();
  const { today } = useToday();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<DebtRow | null>(null);
  const [payFor, setPayFor] = useState<DebtRow | null>(null);
  const [deleting, setDeleting] = useState<DebtRow | null>(null);
  const [busy, setBusy] = useState(false);

  const money = (minor: number, cur: string) => formatMoney(minor, cur, locale);

  // What is still owed, per direction and currency (never added across currencies here).
  const totals = (direction: DebtDirection) => {
    const map = new Map<string, number>();
    for (const d of debts) if (d.direction === direction) map.set(d.currency, (map.get(d.currency) ?? 0) + remaining(d.principal, d.paid));
    return [...map].filter(([, v]) => v > 0);
  };
  const owe = totals("owed_by_me");
  const owed = totals("owed_to_me");

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    const result = await removeDebt(deleting.id);
    setBusy(false);
    setDeleting(null);
    if (result.ok) {
      toast.success(t("toasts.deleted"));
      router.refresh();
    } else toast.error(t(`errors.${result.error}`));
  }

  async function deletePayment(id: string) {
    const result = await removeDebtPayment(id);
    if (result.ok) {
      toast.success(t("toasts.paymentDeleted"));
      router.refresh();
    } else toast.error(t(`errors.${result.error}`));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-[28px] font-extrabold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
          className="gap-1.5"
        >
          <Plus className="size-4" />
          {t("add")}
        </Button>
      </div>

      {debts.length === 0 ? (
        <div className="grid place-items-center gap-3 rounded-3xl border border-dashed bg-card px-6 py-14 text-center">
          <span className="grid size-14 place-items-center rounded-full bg-accent text-accent-foreground">
            <ReceiptText className="size-6" />
          </span>
          <div className="space-y-1">
            <p className="text-lg font-bold">{t("emptyTitle")}</p>
            <p className="max-w-md text-muted-foreground">{t("emptyHint")}</p>
          </div>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            {(
              [
                [t("youOweTotal"), owe, "text-expense"],
                [t("owedToYouTotal"), owed, "text-income"],
              ] as const
            ).map(([label, list, color], i) => (
              <Card key={label} title={label} index={i}>
                {list.length === 0 ? (
                  <p className="amount text-2xl font-extrabold text-muted-foreground">—</p>
                ) : (
                  <ul className="space-y-1">
                    {list.map(([cur, sum]) => (
                      <li key={cur} className={cn("amount text-2xl font-extrabold", color)}>
                        {money(sum, cur)}
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            ))}
          </div>

          <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {debts.map((d, i) => {
              const Icon = KIND_ICON[d.kind];
              const left = remaining(d.principal, d.paid);
              const ratio = progress(d.principal, d.paid);
              const next = today && left > 0 ? nextPaymentDate(d.paymentDay, today) : null;
              const est = left > 0 ? payoff(left, d.interestRate, d.monthlyPayment) : null;
              const list = payments.filter((p) => p.debtId === d.id);
              return (
                <li
                  key={d.id}
                  style={{ "--i": Math.min(i + 1, 8) } as React.CSSProperties}
                  className="reveal flex flex-col gap-4 rounded-3xl border bg-card p-5 shadow-[var(--shadow-card)]"
                >
                  <div className="flex items-center gap-3">
                    <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-accent text-accent-foreground">
                      <Icon className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold">{d.name}</p>
                      <p className="truncate text-sm text-muted-foreground">
                        {t(`kinds.${d.kind}`)} · {t(d.direction === "owed_by_me" ? "owedByMe" : "owedToMe")}
                      </p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label={`${t("actions")}: ${d.name}`} />}>
                        <MoreVertical className="size-5" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="min-w-40">
                        <DropdownMenuItem
                          onClick={() => {
                            setEditing(d);
                            setFormOpen(true);
                          }}
                        >
                          <Pencil className="size-4" />
                          {t("edit")}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setDeleting(d)} className="text-destructive focus:text-destructive">
                          <Trash2 className="size-4" />
                          {t("delete")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="text-sm text-muted-foreground">{t("remaining")}</p>
                      {left === 0 && <span className="rounded-full bg-income-bg px-2.5 py-0.5 text-xs font-bold text-income">{t("paidOff")}</span>}
                    </div>
                    <p className="amount text-3xl font-extrabold">{money(left, d.currency)}</p>
                    <div
                      role="progressbar"
                      aria-label={t("progressLabel", { name: d.name })}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.round(ratio * 100)}
                      className="h-3 w-full overflow-hidden rounded-full bg-muted"
                    >
                      <div className="h-full rounded-full bg-income transition-[width] duration-500" style={{ width: `${ratio * 100}%` }} />
                    </div>
                    <p className="amount text-sm text-muted-foreground">
                      {t("paidOf", { paid: money(d.paid, d.currency), total: money(d.principal, d.currency) })}
                    </p>
                  </div>

                  <dl className="space-y-1 text-sm">
                    {d.monthlyPayment !== null && (
                      <div className="flex justify-between gap-3">
                        <dt className="text-muted-foreground">{t("monthly")}</dt>
                        <dd className="amount font-semibold">{money(d.monthlyPayment, d.currency)}</dd>
                      </div>
                    )}
                    {d.interestRate > 0 && (
                      <div className="flex justify-between gap-3">
                        <dt className="text-muted-foreground">{t("interestShort")}</dt>
                        <dd className="font-semibold">{new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 2 }).format(d.interestRate / 10_000)}</dd>
                      </div>
                    )}
                    {next && (
                      <div className="flex justify-between gap-3">
                        <dt className="text-muted-foreground">{t("nextPaymentLabel")}</dt>
                        <dd className="font-semibold">{formatDate(next, locale, { day: "numeric", month: "long" })}</dd>
                      </div>
                    )}
                  </dl>
                  {left > 0 && d.monthlyPayment !== null && (
                    <p className="rounded-xl bg-muted px-3 py-2 text-sm">
                      {est ? t("payoffEstimate", { months: est.months, interest: money(est.interest, d.currency) }) : t("payoffNever")}
                    </p>
                  )}

                  {left > 0 && (
                    <Button variant="secondary" onClick={() => setPayFor(d)} className="gap-1.5 max-sm:h-10">
                      <Plus className="size-4" />
                      {t("addPayment")}
                    </Button>
                  )}

                  {list.length > 0 && (
                    <details className="rounded-2xl border px-4 py-2">
                      <summary className="cursor-pointer py-1 text-sm font-semibold">{t("payments", { count: list.length })}</summary>
                      <ul className="divide-y">
                        {list.slice(0, 8).map((p) => (
                          <li key={p.id} className="flex items-center gap-3 py-2 text-sm">
                            <div className="min-w-0 flex-1">
                              <p className="font-medium">{formatDate(p.paidOn, locale)}</p>
                              {p.note && <p className="truncate text-muted-foreground">{p.note}</p>}
                            </div>
                            <p className="amount font-semibold">{money(p.amount, d.currency)}</p>
                            <Button variant="ghost" size="icon-sm" aria-label={t("deletePayment")} onClick={() => deletePayment(p.id)}>
                              <X className="size-4" />
                            </Button>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}

      <ResponsiveModal open={formOpen} onOpenChange={setFormOpen} title={t(editing ? "editTitle" : "newTitle")}>
        <DebtForm key={editing?.id ?? "new"} debt={editing} defaultCurrency={currency} onDone={() => setFormOpen(false)} />
      </ResponsiveModal>

      <ResponsiveModal open={!!payFor} onOpenChange={(o) => !o && setPayFor(null)} title={t("paymentTitle")}>
        {payFor && <PaymentForm key={payFor.id} debt={payFor} today={today} onDone={() => setPayFor(null)} />}
      </ResponsiveModal>

      <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-extrabold">{t("deleteTitle")}</DialogTitle>
            <DialogDescription>{deleting && t("deleteBody", { name: deleting.name })}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="secondary" onClick={() => setDeleting(null)}>
              {t("cancel")}
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={busy}>
              {busy && <Loader2 className="size-4 animate-spin" />}
              {t("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MoneyInput({ id, label, hint, currency, value, onChange, error, big = true }: { id: string; label: string; hint?: string; currency: string; value: string; onChange: (v: string) => void; error: string | null; big?: boolean }) {
  const locale = useLocale();
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm font-semibold">
        {label}
      </Label>
      <div className="relative">
        <AmountInput
          id={id}
          placeholder="0"
          currency={currency}
          value={value}
          onValueChange={onChange}
          aria-invalid={!!error}
          className={cn("amount pr-14", big ? "h-14 text-2xl font-extrabold" : "h-12 text-lg font-bold")}
        />
        <span className="pointer-events-none absolute inset-y-0 right-4 grid place-items-center font-bold text-muted-foreground">{currencySymbol(locale, currency)}</span>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : (
        hint && <p className="text-sm text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

function DebtForm({ debt, defaultCurrency, onDone }: { debt: DebtRow | null; defaultCurrency: string; onDone: () => void }) {
  const t = useTranslations("debts");
  const locale = useLocale();
  const router = useRouter();
  const cur = debt?.currency;

  const [name, setName] = useState(debt?.name ?? "");
  const [direction, setDirection] = useState<DebtDirection>(debt?.direction ?? "owed_by_me");
  const [kind, setKind] = useState<DebtKind>(debt?.kind ?? "loan");
  const [currency, setCurrency] = useState(cur ?? defaultCurrency);
  const [principal, setPrincipal] = useState(debt ? formatAmountInput(editableAmount(debt.principal, debt.currency, locale), debt.currency) : "");
  const [interest, setInterest] = useState(debt && debt.interestRate > 0 ? String(debt.interestRate / 100).replace(".", locale === "en" ? "." : ",") : "");
  const [monthly, setMonthly] = useState(debt?.monthlyPayment != null ? formatAmountInput(editableAmount(debt.monthlyPayment, debt.currency, locale), debt.currency) : "");
  const [day, setDay] = useState(debt?.paymentDay != null ? String(debt.paymentDay) : "");
  const [note, setNote] = useState(debt?.note ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const activeCurrency = cur ?? currency;
  const err = (key: string) => (errors[key] ? t(`errors.${errors[key]}`) : null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = "nameRequired";
    const p = parseMinorAmount(principal, locale, activeCurrency);
    if (!p.ok) next.principal = p.error;
    let rate = 0;
    if (interest.trim()) {
      const n = parseAmount(interest, locale);
      if (n === null || n < 0 || n > 100) next.interestRate = "rateInvalid";
      else rate = Math.round(n * 100);
    }
    let monthlyMinor: number | null = null;
    if (monthly.trim()) {
      const m = parseMinorAmount(monthly, locale, activeCurrency);
      if (!m.ok) next.monthlyPayment = m.error;
      else monthlyMinor = m.minor;
    }
    let dayNum: number | null = null;
    if (day.trim()) {
      dayNum = Number(day);
      if (!Number.isInteger(dayNum) || dayNum < 1 || dayNum > 31) next.paymentDay = "dayInvalid";
    }
    setErrors(next);
    if (Object.keys(next).length > 0 || !p.ok) return;

    setSaving(true);
    const base = { name, direction, kind, principal: p.minor, interestRate: rate, monthlyPayment: monthlyMinor, paymentDay: dayNum, note };
    const result = await saveDebt(debt?.id ?? null, debt ? base : { ...base, currency });
    setSaving(false);
    if (result.ok) {
      toast.success(t("toasts.saved"));
      onDone();
      router.refresh();
    } else if (result.fieldErrors && Object.keys(result.fieldErrors).length > 0) {
      setErrors(result.fieldErrors);
    } else setFormError(result.error);
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="debt-name" className="text-sm font-semibold">
          {t("name")}
        </Label>
        <Input id="debt-name" value={name} maxLength={60} placeholder={t("namePlaceholder")} onChange={(e) => setName(e.target.value)} aria-invalid={!!errors.name} />
        {err("name") && (
          <p role="alert" className="text-sm text-destructive">
            {err("name")}
          </p>
        )}
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold">{t("direction")}</legend>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t("direction")}>
          {DEBT_DIRECTIONS.map((v) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={direction === v}
              onClick={() => setDirection(v)}
              className={cn("rounded-2xl border px-3 py-2.5 text-sm font-semibold transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none", direction === v && "border-primary bg-accent text-accent-foreground")}
            >
              {t(v === "owed_by_me" ? "owedByMe" : "owedToMe")}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="debt-kind" className="text-sm font-semibold">
            {t("kind")}
          </Label>
          <NativeSelect id="debt-kind" value={kind} onChange={(e) => setKind(e.target.value as DebtKind)}>
            {DEBT_KINDS.map((k) => (
              <option key={k} value={k}>
                {t(`kinds.${k}`)}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="debt-currency" className="text-sm font-semibold">
            {t("currency")}
          </Label>
          {debt ? (
            <Input id="debt-currency" value={debt.currency} readOnly disabled />
          ) : (
            <CurrencyCombobox id="debt-currency" value={currency} onChange={(c) => { setCurrency(c); setPrincipal((v) => formatAmountInput(v, c)); setMonthly((v) => formatAmountInput(v, c)); }} />
          )}
        </div>
      </div>

      <MoneyInput id="debt-principal" label={t("principal")} currency={activeCurrency} value={principal} onChange={setPrincipal} error={err("principal")} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="debt-interest" className="text-sm font-semibold">
            {t("interest")}
          </Label>
          <Input id="debt-interest" inputMode="decimal" autoComplete="off" placeholder="0" value={interest} onChange={(e) => setInterest(e.target.value)} aria-invalid={!!errors.interestRate} className="amount" />
          {err("interestRate") ? (
            <p role="alert" className="text-sm text-destructive">
              {err("interestRate")}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">{t("interestHint")}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="debt-day" className="text-sm font-semibold">
            {t("paymentDay")}
          </Label>
          <Input id="debt-day" type="number" inputMode="numeric" min={1} max={31} placeholder="—" value={day} onChange={(e) => setDay(e.target.value)} aria-invalid={!!errors.paymentDay} className="amount" />
          {err("paymentDay") && (
            <p role="alert" className="text-sm text-destructive">
              {err("paymentDay")}
            </p>
          )}
        </div>
      </div>

      <MoneyInput id="debt-monthly" label={t("monthlyPayment")} hint={t("monthlyHint")} currency={activeCurrency} value={monthly} onChange={setMonthly} error={err("monthlyPayment")} big={false} />

      <div className="space-y-1.5">
        <Label htmlFor="debt-note" className="text-sm font-semibold">
          {t("note")}
        </Label>
        <Input id="debt-note" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} />
        {err("note") && (
          <p role="alert" className="text-sm text-destructive">
            {err("note")}
          </p>
        )}
      </div>

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

function PaymentForm({ debt, today, onDone }: { debt: DebtRow; today: string; onDone: () => void }) {
  const t = useTranslations("debts");
  const locale = useLocale();
  const router = useRouter();
  const left = remaining(debt.principal, debt.paid);

  // The usual payment is offered, but never more than what is left.
  const [amount, setAmount] = useState(
    debt.monthlyPayment ? formatAmountInput(editableAmount(Math.min(debt.monthlyPayment, left), debt.currency, locale), debt.currency) : "",
  );
  const [date, setDate] = useState(today);
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const err = (key: string) => (errors[key] ? t(`errors.${errors[key]}`) : null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const next: Record<string, string> = {};
    const a = parseMinorAmount(amount, locale, debt.currency);
    if (!a.ok) next.amount = a.error;
    if (!date) next.paidOn = "dateInvalid";
    setErrors(next);
    if (Object.keys(next).length > 0 || !a.ok) return;

    setSaving(true);
    const result = await addDebtPayment({ debtId: debt.id, paidOn: date, amount: a.minor, note });
    setSaving(false);
    if (result.ok) {
      toast.success(t("toasts.paymentAdded"));
      onDone();
      router.refresh();
    } else if (result.fieldErrors && Object.keys(result.fieldErrors).length > 0) {
      setErrors(result.fieldErrors);
    } else setFormError(result.error);
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <p className="text-sm text-muted-foreground">
        {debt.name} · {t("remainingIs", { amount: formatMoney(left, debt.currency, locale) })}
      </p>
      <MoneyInput id="pay-amount" label={t("paymentAmount")} currency={debt.currency} value={amount} onChange={setAmount} error={err("amount")} />
      <div className="space-y-1.5">
        <Label htmlFor="pay-date" className="text-sm font-semibold">
          {t("paymentDate")}
        </Label>
        <Input id="pay-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-invalid={!!errors.paidOn} />
        {err("paidOn") && (
          <p role="alert" className="text-sm text-destructive">
            {err("paidOn")}
          </p>
        )}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="pay-note" className="text-sm font-semibold">
          {t("paymentNote")}
        </Label>
        <Input id="pay-note" value={note} maxLength={120} onChange={(e) => setNote(e.target.value)} />
      </div>
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

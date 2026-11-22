"use client";

import { Building2, Loader2, MoreVertical, Pencil, Plus, Scale, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { removeAccount, saveAccount, setAccountBalance } from "@/app/(app)/accounts/actions";
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
import { KIND_FACE, KIND_ICON } from "@/components/finance/account-kind";
import { ACCOUNT_KINDS, type AccountKind } from "@/lib/accounts";
import { formatMoney } from "@/lib/money";
import { currencySymbol, editableAmount, formatAmountInput } from "@/lib/money-input";
import { parseSignedMinor } from "@/lib/money-signed";
import type { AccountRow } from "@/lib/services/accounts";
import { cn } from "@/lib/utils";

export function AccountsView({ accounts, currency }: { accounts: AccountRow[]; currency: string }) {
  const t = useTranslations("accounts");
  const locale = useLocale();
  const router = useRouter();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AccountRow | null>(null);
  const [balanceFor, setBalanceFor] = useState<AccountRow | null>(null);
  const [deleting, setDeleting] = useState<AccountRow | null>(null);
  const [busy, setBusy] = useState(false);

  const active = accounts.filter((a) => !a.isArchived);
  const archived = accounts.filter((a) => a.isArchived);

  // Totals per currency, so different currencies are never added together here (the overview converts them).
  const totals = new Map<string, number>();
  for (const a of active) totals.set(a.currency, (totals.get(a.currency) ?? 0) + a.balance);

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    const result = await removeAccount(deleting.id);
    setBusy(false);
    setDeleting(null);
    if (result.ok) {
      toast.success(t("toasts.deleted"));
      router.refresh();
    } else {
      toast.error(t(`errors.${result.error}`));
    }
  }

  // A bank-card look: a dark gradient face (so the white text is readable in both themes), the kind's icon,
  // the name, the balance and the currency. The menu sits in the corner.
  const row = (a: AccountRow, i: number) => {
    const Icon = KIND_ICON[a.kind];
    return (
      <li
        key={a.id}
        style={{ "--i": Math.min(i + 1, 8) } as React.CSSProperties}
        className={cn(
          "reveal lift group relative min-h-44 overflow-hidden rounded-3xl p-5 text-white shadow-[var(--shadow-card)]",
          KIND_FACE[a.kind],
          a.isArchived && "opacity-65",
        )}
      >
        <div aria-hidden className="pointer-events-none absolute -top-12 -right-12 size-48 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.2),transparent_65%)]" />
        <div aria-hidden className="pointer-events-none absolute -bottom-16 -left-10 size-48 rounded-full bg-[radial-gradient(circle,rgba(18,185,129,0.25),transparent_65%)]" />

        <div className="relative flex items-start justify-between gap-3">
          <span className="grid size-11 place-items-center rounded-2xl bg-white/15 backdrop-blur-sm">
            <Icon className="size-5" />
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="text-white hover:bg-white/15 hover:text-white" aria-label={`${t("actions")}: ${a.name}`} />}>
              <MoreVertical className="size-5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-44">
              <DropdownMenuItem onClick={() => setBalanceFor(a)}>
                <Scale className="size-4" />
                {t("setBalance")}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setEditing(a);
                  setFormOpen(true);
                }}
              >
                <Pencil className="size-4" />
                {t("edit")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setDeleting(a)} className="text-destructive focus:text-destructive">
                <Trash2 className="size-4" />
                {t("delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="relative mt-6 min-w-0 space-y-1">
          <p className="truncate font-bold">{a.name}</p>
          <p className={cn("amount truncate text-2xl font-extrabold", a.balance < 0 && "text-red-200")}>{formatMoney(a.balance, a.currency, locale)}</p>
          <p className="flex flex-wrap items-center gap-2 text-xs font-semibold">
            {t(`kinds.${a.kind}`)} · {a.currency}
            {!a.inNetWorth && <span className="rounded-full bg-white/20 px-2 py-0.5">{t("notInNetWorth")}</span>}
          </p>
        </div>
      </li>
    );
  };

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

      {accounts.length === 0 ? (
        <div className="grid place-items-center gap-3 rounded-3xl border border-dashed bg-card px-6 py-14 text-center">
          <span className="grid size-14 place-items-center rounded-full bg-accent text-accent-foreground">
            <Building2 className="size-6" />
          </span>
          <div className="space-y-1">
            <p className="text-lg font-bold">{t("emptyTitle")}</p>
            <p className="max-w-md text-muted-foreground">{t("emptyHint")}</p>
          </div>
        </div>
      ) : (
        <>
          {totals.size > 0 && (
            <Card title={t("totals")} index={0}>
              <ul className="flex flex-wrap gap-x-8 gap-y-2">
                {[...totals].map(([cur, sum]) => (
                  <li key={cur} className="amount text-xl font-extrabold">
                    <span className={cn(sum < 0 && "text-expense")}>{formatMoney(sum, cur, locale)}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-sm text-muted-foreground">{t("totalsHint", { currency })}</p>
            </Card>
          )}
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">{active.map(row)}</ul>
          {archived.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-bold text-muted-foreground">{t("archivedTitle")}</h2>
              <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">{archived.map(row)}</ul>
            </section>
          )}
        </>
      )}

      <AccountFormDialog open={formOpen} onOpenChange={setFormOpen} account={editing} defaultCurrency={currency} />
      <BalanceDialog account={balanceFor} onClose={() => setBalanceFor(null)} />

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

/** A balance field with the sign as a switch: nobody has to type a minus. */
function BalanceField({
  id,
  label,
  hint,
  currency,
  amount,
  onAmount,
  negative,
  onNegative,
  error,
}: {
  id: string;
  label: string;
  hint?: string;
  currency: string;
  amount: string;
  onAmount: (v: string) => void;
  negative: boolean;
  onNegative: (v: boolean) => void;
  error: string | null;
}) {
  const t = useTranslations("accounts");
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
          value={amount}
          onValueChange={onAmount}
          aria-invalid={!!error}
          className={cn("amount h-14 pr-14 text-2xl font-extrabold", negative && "text-expense")}
        />
        <span className="pointer-events-none absolute inset-y-0 right-4 grid place-items-center text-lg font-bold text-muted-foreground">
          {currencySymbol(locale, currency)}
        </span>
      </div>
      <label className="flex items-center gap-3 text-sm font-medium">
        <input type="checkbox" checked={negative} onChange={(e) => onNegative(e.target.checked)} className="size-5 rounded accent-[var(--primary)]" />
        {t("negative")}
      </label>
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

function AccountFormDialog({
  open,
  onOpenChange,
  account,
  defaultCurrency,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: AccountRow | null;
  defaultCurrency: string;
}) {
  const t = useTranslations("accounts");
  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange} title={t(account ? "editTitle" : "newTitle")}>
      <AccountForm key={account?.id ?? "new"} account={account} defaultCurrency={defaultCurrency} onDone={() => onOpenChange(false)} />
    </ResponsiveModal>
  );
}

function AccountForm({ account, defaultCurrency, onDone }: { account: AccountRow | null; defaultCurrency: string; onDone: () => void }) {
  const t = useTranslations("accounts");
  const locale = useLocale();
  const router = useRouter();
  const cur = account?.currency ?? "";

  const [name, setName] = useState(account?.name ?? "");
  const [kind, setKind] = useState<AccountKind>(account?.kind ?? "checking");
  const [currency, setCurrency] = useState(account?.currency ?? defaultCurrency);
  const [amount, setAmount] = useState(
    account && account.openingBalance !== 0 ? formatAmountInput(editableAmount(Math.abs(account.openingBalance), cur, locale), cur) : "",
  );
  const [negative, setNegative] = useState((account?.openingBalance ?? 0) < 0);
  const [inNetWorth, setInNetWorth] = useState(account?.inNetWorth ?? true);
  const [archived, setArchived] = useState(account?.isArchived ?? false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const err = (key: string) => (errors[key] ? t(`errors.${errors[key]}`) : null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = "nameRequired";
    const opening = parseSignedMinor(amount, negative, locale, currency);
    if (!opening.ok) next.openingBalance = opening.error;
    setErrors(next);
    if (Object.keys(next).length > 0 || !opening.ok) return;

    setSaving(true);
    const base = { name, kind, openingBalance: opening.minor, inNetWorth, isArchived: archived };
    const result = await saveAccount(account?.id ?? null, account ? base : { ...base, currency });
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
        <Label htmlFor="acc-name" className="text-sm font-semibold">
          {t("name")}
        </Label>
        <Input id="acc-name" value={name} maxLength={60} placeholder={t("namePlaceholder")} onChange={(e) => setName(e.target.value)} aria-invalid={!!errors.name} />
        {err("name") && (
          <p role="alert" className="text-sm text-destructive">
            {err("name")}
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="acc-kind" className="text-sm font-semibold">
            {t("kind")}
          </Label>
          <NativeSelect id="acc-kind" value={kind} onChange={(e) => setKind(e.target.value as AccountKind)}>
            {ACCOUNT_KINDS.map((k) => (
              <option key={k} value={k}>
                {t(`kinds.${k}`)}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="acc-currency" className="text-sm font-semibold">
            {t("currency")}
          </Label>
          {account ? (
            <Input id="acc-currency" value={account.currency} readOnly disabled />
          ) : (
            <CurrencyCombobox id="acc-currency" value={currency} onChange={(c) => { setCurrency(c); setAmount((a) => formatAmountInput(a, c)); }} />
          )}
          {err("currency") && (
            <p role="alert" className="text-sm text-destructive">
              {err("currency")}
            </p>
          )}
        </div>
      </div>
      {!account && <p className="-mt-3 text-sm text-muted-foreground">{t("currencyHint")}</p>}

      <BalanceField
        id="acc-opening"
        label={t("opening")}
        hint={t("openingHint")}
        currency={account?.currency ?? currency}
        amount={amount}
        onAmount={setAmount}
        negative={negative}
        onNegative={setNegative}
        error={err("openingBalance")}
      />

      <div className="space-y-3">
        <label className="flex items-center gap-3 text-sm font-medium">
          <input type="checkbox" checked={inNetWorth} onChange={(e) => setInNetWorth(e.target.checked)} className="size-5 rounded accent-[var(--primary)]" />
          {t("inNetWorth")}
        </label>
        {account && (
          <label className="flex items-center gap-3 text-sm font-medium">
            <input type="checkbox" checked={archived} onChange={(e) => setArchived(e.target.checked)} className="size-5 rounded accent-[var(--primary)]" />
            {t("archived")}
          </label>
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

function BalanceDialog({ account, onClose }: { account: AccountRow | null; onClose: () => void }) {
  const t = useTranslations("accounts");
  return (
    <ResponsiveModal open={!!account} onOpenChange={(o) => !o && onClose()} title={t("setBalanceTitle")}>
      {account && <BalanceForm key={account.id} account={account} onDone={onClose} />}
    </ResponsiveModal>
  );
}

function BalanceForm({ account, onDone }: { account: AccountRow; onDone: () => void }) {
  const t = useTranslations("accounts");
  const locale = useLocale();
  const router = useRouter();
  const [amount, setAmount] = useState(
    account.balance !== 0 ? formatAmountInput(editableAmount(Math.abs(account.balance), account.currency, locale), account.currency) : "",
  );
  const [negative, setNegative] = useState(account.balance < 0);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = parseSignedMinor(amount, negative, locale, account.currency);
    if (!parsed.ok) return setError(parsed.error);
    setSaving(true);
    const result = await setAccountBalance(account.id, { balance: parsed.minor });
    setSaving(false);
    if (result.ok) {
      toast.success(t("toasts.balanceSet"));
      onDone();
      router.refresh();
    } else {
      setError(result.fieldErrors?.balance ?? result.error);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <p className="text-sm text-muted-foreground">
        {account.name} · {account.currency}
      </p>
      <BalanceField
        id="bal-amount"
        label={t("balance")}
        hint={t("setBalanceHint")}
        currency={account.currency}
        amount={amount}
        onAmount={setAmount}
        negative={negative}
        onNegative={setNegative}
        error={error ? t(`errors.${error}`) : null}
      />
      <Button type="submit" disabled={saving} className="w-full gap-1.5">
        {saving && <Loader2 className="size-4 animate-spin" />}
        {t("save")}
      </Button>
    </form>
  );
}

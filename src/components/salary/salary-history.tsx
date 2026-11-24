"use client";

import { Banknote, Gift, Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { removeSalaryRecord } from "@/app/(app)/salary/actions";
import { Card } from "@/components/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDate } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import type { SalaryMode } from "@/lib/salary";

export type HistoryRecord = {
  id: string;
  currency: string;
  title: string | null;
  payDate: string;
  mode: SalaryMode;
  gross: number;
  net: number;
  overtimePay: number;
  bonusTotal: number;
  deductionTotal: number;
  bonuses: { id: string; label: string; amount: number }[];
};

export function SalaryHistory({ records }: { records: HistoryRecord[] }) {
  const t = useTranslations("salary");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const [deleting, setDeleting] = useState<HistoryRecord | null>(null);
  const [busy, setBusy] = useState(false);

  const date = (iso: string) => formatDate(iso, locale);
  const nameOf = (r: HistoryRecord) => r.title || `${t(`modes.${r.mode}`)} · ${date(r.payDate)}`;

  // Every bonus, newest pay date first (records already come newest first).
  const bonusRows = records.flatMap((r) => r.bonuses.map((b) => ({ ...b, record: r })));

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    const result = await removeSalaryRecord(deleting.id);
    setBusy(false);
    setDeleting(null);
    if (result.ok) {
      toast.success(t("toasts.deleted"));
      router.refresh();
    } else {
      toast.error(t(`errors.${result.error}`));
    }
  }

  return (
    <>
      <Card title={t("historyTitle")} index={3}>
        {records.length === 0 ? (
          <div className="grid place-items-center gap-3 px-2 py-8 text-center">
            <span className="grid size-12 place-items-center rounded-full bg-accent text-accent-foreground">
              <Banknote className="size-5" />
            </span>
            <p className="font-bold">{t("historyEmpty")}</p>
            <p className="max-w-md text-sm text-muted-foreground">{t("historyEmptyHint")}</p>
          </div>
        ) : (
          <ul className="divide-y">
            {records.map((r) => (
              <li key={r.id} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{nameOf(r)}</p>
                  <p className="amount truncate text-sm text-muted-foreground">
                    {r.title ? `${date(r.payDate)} · ` : ""}
                    {t("grossShort", { amount: formatMoney(r.gross, r.currency, locale) })}
                    {r.deductionTotal > 0 && ` · ${t("deductionsShort", { amount: formatMoney(r.deductionTotal, r.currency, locale) })}`}
                  </p>
                </div>
                <p className="amount text-end text-lg font-extrabold">{formatMoney(r.net, r.currency, locale)}</p>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`${t("delete")}: ${nameOf(r)}`}
                  onClick={() => setDeleting(r)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title={t("bonusHistoryTitle")} index={4}>
        {bonusRows.length === 0 ? (
          <div className="grid place-items-center gap-3 px-2 py-8 text-center">
            <span className="grid size-12 place-items-center rounded-full bg-accent text-accent-foreground">
              <Gift className="size-5" />
            </span>
            <p className="font-bold">{t("bonusHistoryEmpty")}</p>
          </div>
        ) : (
          <ul className="divide-y">
            {bonusRows.map((b) => (
              <li key={b.id} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{b.label}</p>
                  <p className="truncate text-sm text-muted-foreground">{date(b.record.payDate)}</p>
                </div>
                <p className="amount font-bold">{formatMoney(b.amount, b.record.currency, locale)}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-extrabold">{t("deleteTitle")}</DialogTitle>
            <DialogDescription>{deleting && t("deleteBody", { name: nameOf(deleting) })}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="secondary" onClick={() => setDeleting(null)}>
              {tc("cancel")}
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={busy}>
              {busy && <Loader2 className="size-4 animate-spin" />}
              {t("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

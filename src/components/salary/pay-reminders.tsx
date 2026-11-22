"use client";

import { BellRing, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";
import { dueReminders } from "@/lib/salary-schedule";
import type { ScheduleRow } from "@/lib/services/schedules";
import { useToday } from "@/lib/use-today";

/**
 * A reminder bar for payments that are close: shown on every page while a pay date is within its "remind me"
 * window. It can be closed for the rest of the visit; it comes back on the next page load.
 */
export function PayReminders({ schedules }: { schedules: ScheduleRow[] }) {
  const t = useTranslations("salary.schedule");
  const locale = useLocale();
  const { today } = useToday();
  const [closed, setClosed] = useState(false);

  // Waits for the browser's own "today"; nothing is shown (or decided) on the server.
  if (!today || closed || schedules.length === 0) return null;
  const due = dueReminders(schedules, today);
  if (due.length === 0) return null;

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 pt-4 sm:px-6 sm:pt-6 print:hidden">
      <div
        role="status"
        className="flex items-start gap-3 rounded-2xl bg-accent px-4 py-3 text-sm text-accent-foreground"
      >
        <BellRing className="mt-0.5 size-4 shrink-0" aria-hidden />
        <ul className="min-w-0 flex-1 space-y-1">
          {due.map((p) => {
            const amount = formatMoney(p.amount, p.currency, locale);
            return (
              <li key={`${p.scheduleId}-${p.date}`} className="font-medium">
                {p.days === 0
                  ? t("reminderToday", { title: p.title, amount })
                  : p.days === 1
                    ? t("reminderTomorrow", { title: p.title, amount })
                    : t("reminderDays", { title: p.title, count: p.days, amount })}
              </li>
            );
          })}
        </ul>
        <Link href="/salary" className="shrink-0 font-semibold underline-offset-2 hover:underline">
          {t("open")}
        </Link>
        <Button type="button" variant="ghost" size="icon-sm" aria-label={t("close")} onClick={() => setClosed(true)}>
          <X className="size-4" />
        </Button>
      </div>
    </div>
  );
}

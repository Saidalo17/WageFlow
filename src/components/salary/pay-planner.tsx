"use client";

import { CalendarDays, CalendarPlus, Loader2, MoreVertical, Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { removeSchedule } from "@/app/(app)/salary/schedule-actions";
import { Card } from "@/components/card";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDate } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { nextPayDate, upcomingPayments, daysUntil } from "@/lib/salary-schedule";
import type { ScheduleRow } from "@/lib/services/schedules";
import { useToday } from "@/lib/use-today";
import { cn } from "@/lib/utils";
import { ScheduleFormDialog } from "./schedule-form-dialog";

/** Pay dates, what is expected in the coming weeks, reminders and the calendar file. */
export function PayPlanner({
  schedules,
  currency,
  suggestedNet,
}: {
  schedules: ScheduleRow[];
  currency: string;
  suggestedNet: number | null;
}) {
  const t = useTranslations("salary.schedule");
  const locale = useLocale();
  const router = useRouter();
  const { today } = useToday();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ScheduleRow | null>(null);
  const [deleting, setDeleting] = useState<ScheduleRow | null>(null);
  const [busy, setBusy] = useState(false);

  const money = (minor: number, cur: string) => formatMoney(minor, cur, locale);
  const date = (iso: string) => formatDate(iso, locale, { day: "numeric", month: "long", weekday: "short" });

  // Everything that depends on today waits for the browser, so it is never worked out in the server's time zone.
  const upcoming = today ? upcomingPayments(schedules, today, 90) : [];
  const sumWithin = (days: number) =>
    upcoming.filter((p) => p.days <= days && p.currency === currency).reduce((s, p) => s + p.amount, 0);

  const when = (days: number) => (days === 0 ? t("today") : days === 1 ? t("tomorrow") : t("inDays", { count: days }));

  function describe(s: ScheduleRow) {
    if (s.frequency === "monthly") return t("monthlyOn", { day: s.dayOfMonth });
    return `${t(`freq.${s.frequency}`)}${s.anchorDate ? ` · ${formatDate(s.anchorDate, locale, { day: "numeric", month: "short" })}` : ""}`;
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    const result = await removeSchedule(deleting.id);
    setBusy(false);
    setDeleting(null);
    if (result.ok) {
      toast.success(t("toasts.deleted"));
      router.refresh();
    } else {
      toast.error(t(`errors.${result.error}`));
    }
  }

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  return (
    <>
      <Card
        title={t("title")}
        index={5}
        action={
          <Button size="sm" onClick={openCreate} className="gap-1.5 max-sm:h-10">
            <Plus className="size-4" />
            {t("add")}
          </Button>
        }
      >
        {schedules.length === 0 ? (
          <div className="grid place-items-center gap-3 px-2 py-8 text-center">
            <span className="grid size-12 place-items-center rounded-full bg-accent text-accent-foreground">
              <CalendarDays className="size-5" />
            </span>
            <p className="font-bold">{t("emptyTitle")}</p>
            <p className="max-w-md text-sm text-muted-foreground">{t("emptyHint")}</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* What is expected */}
            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  [t("expected30"), sumWithin(30)],
                  [t("expected90"), sumWithin(90)],
                ] as const
              ).map(([label, value]) => (
                <div key={label} className="rounded-2xl bg-muted p-4">
                  <p className="text-sm text-muted-foreground">{label}</p>
                  <p className="amount text-2xl font-extrabold">{today ? money(value, currency) : "—"}</p>
                </div>
              ))}
            </div>

            {/* Next payments */}
            <section>
              <h3 className="mb-2 text-sm font-bold">{t("upcomingTitle")}</h3>
              {!today ? null : upcoming.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("nothingUpcoming")}</p>
              ) : (
                <ul className="divide-y">
                  {upcoming.slice(0, 6).map((p) => (
                    <li key={`${p.scheduleId}-${p.date}`} className="flex items-center gap-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">{p.title}</p>
                        <p className="truncate text-sm text-muted-foreground">
                          {date(p.date)} · {when(p.days)}
                        </p>
                      </div>
                      <p className="amount font-bold">{money(p.amount, p.currency)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* The schedules themselves */}
            <section>
              <h3 className="mb-2 text-sm font-bold">{t("schedulesTitle")}</h3>
              <ul className="divide-y">
                {schedules.map((s) => {
                  const next = today && s.isActive ? nextPayDate(s, today) : null;
                  return (
                    <li key={s.id} className="flex items-center gap-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className={cn("truncate font-semibold", !s.isActive && "text-muted-foreground")}>
                          {s.title}
                          {!s.isActive && <span className="ms-2 text-xs font-medium">{t("paused")}</span>}
                        </p>
                        <p className="truncate text-sm text-muted-foreground">
                          {describe(s)}
                          {next && today ? ` · ${t("next", { when: when(daysUntil(next, today)) })}` : ""}
                        </p>
                      </div>
                      <p className="amount font-bold">{money(s.expectedNet, s.currency)}</p>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={<Button variant="ghost" size="icon" aria-label={`${t("actions")}: ${s.title}`} />}
                        >
                          <MoreVertical className="size-5" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="min-w-40">
                          <DropdownMenuItem
                            onClick={() => {
                              setEditing(s);
                              setFormOpen(true);
                            }}
                          >
                            <Pencil className="size-4" />
                            {t("edit")}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => setDeleting(s)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="size-4" />
                            {t("delete")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </li>
                  );
                })}
              </ul>
            </section>

            {/* Calendar */}
            <div className="flex flex-wrap items-center gap-3 rounded-2xl border p-4">
              <p className="min-w-0 flex-1 text-sm text-muted-foreground">{t("calendarHint")}</p>
              <a
                href="/api/salary/calendar"
                download
                className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "gap-1.5 max-sm:h-10")}
              >
                <CalendarPlus className="size-4" />
                {t("calendar")}
              </a>
            </div>
          </div>
        )}
      </Card>

      <ScheduleFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        schedule={editing}
        currency={currency}
        suggestedNet={suggestedNet}
        today={today}
      />

      <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-extrabold">{t("deleteTitle")}</DialogTitle>
            <DialogDescription>{deleting && t("deleteBody", { name: deleting.title })}</DialogDescription>
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
    </>
  );
}

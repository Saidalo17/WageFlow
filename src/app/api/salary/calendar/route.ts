import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { isLocale } from "@/i18n/config";
import { todayISO } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { addDaysISO, buildIcs, payDatesBetween } from "@/lib/salary-schedule";
import { listSchedules } from "@/lib/services/schedules";

/**
 * GET /api/salary/calendar
 * The signed-in user's pay schedules as a calendar file (.ics): one all-day event per payment for the next
 * 12 months, each with a reminder. Nobody else's schedules can be requested.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const [user] = await db
    .select({ locale: users.locale })
    .from(users)
    .where(eq(users.id, session.user.id));
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const locale = isLocale(user.locale) ? user.locale : "en";
  const messages = (await import(`../../../../messages/${locale}.json`)).default as {
    salary: { schedule: { calendarEvent: string; calendarExpected: string; calendarName: string } };
  };
  const text = messages.salary.schedule;
  const fill = (template: string, values: Record<string, string>) =>
    template.replace(/\{(\w+)\}/g, (_, k: string) => values[k] ?? "");

  const today = todayISO();
  const end = addDaysISO(today, 365);
  const events = (await listSchedules(session.user.id))
    .filter((s) => s.isActive)
    .flatMap((s) =>
      payDatesBetween(s, today, end).map((date) => ({
        uid: `${s.id}-${date}@wageflow`,
        date,
        summary: fill(text.calendarEvent, { title: s.title }),
        description: fill(text.calendarExpected, { amount: formatMoney(s.expectedNet, s.currency, locale) }),
        remindDaysBefore: s.remindDaysBefore,
      })),
    );

  return new Response(buildIcs(events, text.calendarName), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="wageflow-pay-dates.ics"`,
      "Cache-Control": "no-store",
    },
  });
}

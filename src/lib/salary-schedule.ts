/**
 * Pay schedules: which days a salary is paid, what is expected, and the calendar file for it.
 * Pure functions. Dates are "YYYY-MM-DD" strings; "today" is passed in (the browser's today, not the server's).
 */

export const FREQUENCIES = ["monthly", "biweekly", "weekly"] as const;
export type Frequency = (typeof FREQUENCIES)[number];

export type Schedule = {
  frequency: Frequency;
  /** monthly: 1-31; the last day of the month when the month is shorter. */
  dayOfMonth: number;
  /** weekly / biweekly: a date the payments fall on. */
  anchorDate: string | null;
};

const DAY = 86_400_000;

function toUTC(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function fromUTC(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

export function addDaysISO(iso: string, n: number): string {
  return fromUTC(toUTC(iso) + n * DAY);
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function daysUntil(to: string, from: string): number {
  return Math.round((toUTC(to) - toUTC(from)) / DAY);
}

/** Longest range handled in one call, so a mistake can never build a huge list. */
const MAX_DATES = 400;

/** Every payment date from `from` to `to`, both included, oldest first. */
export function payDatesBetween(s: Schedule, from: string, to: string): string[] {
  if (from > to) return [];
  const out: string[] = [];

  if (s.frequency === "monthly") {
    const [fy, fm] = from.split("-").map(Number);
    const [ty, tm] = to.split("-").map(Number);
    for (let y = fy, m = fm; y < ty || (y === ty && m <= tm); m === 12 ? (y++, (m = 1)) : m++) {
      const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
      const date = `${y}-${String(m).padStart(2, "0")}-${String(Math.min(s.dayOfMonth, last)).padStart(2, "0")}`;
      if (date >= from && date <= to) out.push(date);
      if (out.length >= MAX_DATES) break;
    }
    return out;
  }

  if (!s.anchorDate) return out;
  const step = s.frequency === "weekly" ? 7 : 14;
  const diff = daysUntil(from, s.anchorDate);
  // The pattern continues in both directions from the anchor date.
  let date = addDaysISO(s.anchorDate, Math.ceil(diff / step) * step);
  while (date <= to && out.length < MAX_DATES) {
    if (date >= from) out.push(date);
    date = addDaysISO(date, step);
  }
  return out;
}

/** The next payment on or after `today`, or null. */
export function nextPayDate(s: Schedule, today: string): string | null {
  return payDatesBetween(s, today, addDaysISO(today, 400))[0] ?? null;
}

export type Upcoming = { scheduleId: string; date: string; days: number; amount: number; currency: string; title: string };

type Planned = Schedule & { id: string; title: string; expectedNet: number; currency: string; isActive: boolean };

/** The payments coming up in the next `horizonDays`, soonest first. Inactive schedules are left out. */
export function upcomingPayments(schedules: Planned[], today: string, horizonDays: number): Upcoming[] {
  const end = addDaysISO(today, horizonDays);
  return schedules
    .filter((s) => s.isActive)
    .flatMap((s) =>
      payDatesBetween(s, today, end).map((date) => ({
        scheduleId: s.id,
        date,
        days: daysUntil(date, today),
        amount: s.expectedNet,
        currency: s.currency,
        title: s.title,
      })),
    )
    .sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));
}

/** Payments to remind about now: the next payment of a schedule is within its "remind before" days. */
export function dueReminders(schedules: (Planned & { remindDaysBefore: number })[], today: string): Upcoming[] {
  const out: Upcoming[] = [];
  for (const s of schedules) {
    if (!s.isActive) continue;
    const date = nextPayDate(s, today);
    if (!date) continue;
    const days = daysUntil(date, today);
    if (days <= s.remindDaysBefore) {
      out.push({ scheduleId: s.id, date, days, amount: s.expectedNet, currency: s.currency, title: s.title });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

// ---------- Calendar file (.ics, RFC 5545) ----------

/** Text values: backslash, semicolon, comma and line breaks are escaped. */
export function icsEscape(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Lines are cut at 75 bytes; the rest continues on the next line after a space. */
export function icsFold(line: string): string {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const parts: string[] = [];
  let current = "";
  let bytes = 0;
  for (const ch of line) {
    const size = enc.encode(ch).length;
    const limit = parts.length === 0 ? 75 : 74; // continuation lines start with a space
    if (bytes + size > limit) {
      parts.push(current);
      current = "";
      bytes = 0;
    }
    current += ch;
    bytes += size;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

export type CalendarEvent = {
  uid: string;
  /** YYYY-MM-DD, an all-day event. */
  date: string;
  summary: string;
  description?: string;
  /** Alarm this many days before; 0 = on the day (at 09:00). */
  remindDaysBefore: number;
};

export function buildIcs(events: CalendarEvent[], calendarName: string, now = new Date()): string {
  const stamp = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}${String(now.getUTCDate()).padStart(2, "0")}T${String(now.getUTCHours()).padStart(2, "0")}${String(now.getUTCMinutes()).padStart(2, "0")}${String(now.getUTCSeconds()).padStart(2, "0")}Z`;
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//WageFlow//Salary//EN", "CALSCALE:GREGORIAN", `X-WR-CALNAME:${icsEscape(calendarName)}`];
  for (const e of events) {
    const compact = e.date.replace(/-/g, "");
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.uid}`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${compact}`,
      `DTEND;VALUE=DATE:${addDaysISO(e.date, 1).replace(/-/g, "")}`,
      `SUMMARY:${icsEscape(e.summary)}`,
    );
    if (e.description) lines.push(`DESCRIPTION:${icsEscape(e.description)}`);
    lines.push(
      "TRANSP:TRANSPARENT",
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `DESCRIPTION:${icsEscape(e.summary)}`,
      // An all-day event starts at 00:00, so "9 hours after" is 09:00 on the day.
      e.remindDaysBefore > 0 ? `TRIGGER:-P${e.remindDaysBefore}D` : "TRIGGER:PT9H",
      "END:VALARM",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(icsFold).join("\r\n") + "\r\n";
}

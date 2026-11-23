import { describe, expect, it } from "vitest";
import {
  addDaysISO,
  buildIcs,
  daysUntil,
  dueReminders,
  icsEscape,
  icsFold,
  nextPayDate,
  payDatesBetween,
  upcomingPayments,
  type Schedule,
} from "@/lib/salary-schedule";

const monthly = (day: number): Schedule => ({ frequency: "monthly", dayOfMonth: day, anchorDate: null });

describe("date helpers", () => {
  it("adds days across months and counts days", () => {
    expect(addDaysISO("2026-11-28", 5)).toBe("2026-12-03");
    expect(addDaysISO("2026-03-01", -1)).toBe("2026-02-28");
    expect(daysUntil("2026-12-01", "2026-11-22")).toBe(9);
    expect(daysUntil("2026-11-20", "2026-11-22")).toBe(-2);
  });
});

describe("payDatesBetween", () => {
  it("monthly: the chosen day of every month in the range", () => {
    expect(payDatesBetween(monthly(10), "2026-11-22", "2027-02-28")).toEqual(["2026-12-10", "2027-01-10", "2027-02-10"]);
  });
  it("monthly: includes both ends of the range", () => {
    expect(payDatesBetween(monthly(22), "2026-11-22", "2026-12-22")).toEqual(["2026-11-22", "2026-12-22"]);
  });
  it("monthly: day 31 falls on the last day of shorter months", () => {
    expect(payDatesBetween(monthly(31), "2027-01-01", "2027-04-30")).toEqual(["2027-01-31", "2027-02-28", "2027-03-31", "2027-04-30"]);
    expect(payDatesBetween(monthly(31), "2028-02-01", "2028-02-29")).toEqual(["2028-02-29"]); // leap year
  });
  it("biweekly: every 14 days from the anchor, also before and after it", () => {
    const s: Schedule = { frequency: "biweekly", dayOfMonth: 1, anchorDate: "2026-11-06" };
    expect(payDatesBetween(s, "2026-11-22", "2027-01-05")).toEqual(["2026-12-04", "2026-12-18", "2027-01-01"]);
    expect(payDatesBetween(s, "2026-10-01", "2026-11-10")).toEqual(["2026-10-09", "2026-10-23", "2026-11-06"]);
  });
  it("weekly: every 7 days", () => {
    const s: Schedule = { frequency: "weekly", dayOfMonth: 1, anchorDate: "2026-11-20" };
    expect(payDatesBetween(s, "2026-11-22", "2026-12-12")).toEqual(["2026-11-27", "2026-12-04", "2026-12-11"]);
  });
  it("weekly without an anchor has no dates; a reversed range is empty", () => {
    expect(payDatesBetween({ frequency: "weekly", dayOfMonth: 1, anchorDate: null }, "2026-01-01", "2026-12-31")).toEqual([]);
    expect(payDatesBetween(monthly(5), "2026-12-01", "2026-11-01")).toEqual([]);
  });
});

describe("nextPayDate", () => {
  it("is today when today is a pay day", () => {
    expect(nextPayDate(monthly(22), "2026-11-22")).toBe("2026-11-22");
  });
  it("rolls over to next month and next year", () => {
    expect(nextPayDate(monthly(5), "2026-11-22")).toBe("2026-12-05");
    expect(nextPayDate(monthly(5), "2026-12-22")).toBe("2027-01-05");
  });
});

const planned = (over: Partial<Parameters<typeof upcomingPayments>[0][number] & { remindDaysBefore: number }> = {}) => ({
  id: "a",
  title: "Main job",
  frequency: "monthly" as const,
  dayOfMonth: 28,
  anchorDate: null,
  expectedNet: 250_000,
  currency: "RUB",
  isActive: true,
  remindDaysBefore: 3,
  ...over,
});

describe("upcomingPayments", () => {
  it("lists payments in the horizon, soonest first, with the days to go", () => {
    const list = upcomingPayments([planned(), planned({ id: "b", title: "Side", dayOfMonth: 25, expectedNet: 50_000 })], "2026-11-22", 40);
    expect(list.map((p) => [p.title, p.date, p.days])).toEqual([
      ["Side", "2026-11-25", 3],
      ["Main job", "2026-11-28", 6],
      ["Side", "2026-12-25", 33],
      ["Main job", "2026-12-28", 36],
    ]);
  });
  it("leaves inactive schedules out", () => {
    expect(upcomingPayments([planned({ isActive: false })], "2026-11-22", 60)).toEqual([]);
  });
});

describe("dueReminders", () => {
  it("reminds only when the next payment is within the reminder window", () => {
    expect(dueReminders([planned()], "2026-11-24")).toEqual([]); // 4 days away, window is 3
    expect(dueReminders([planned()], "2026-11-25").map((r) => r.days)).toEqual([3]);
    expect(dueReminders([planned()], "2026-11-28").map((r) => r.days)).toEqual([0]);
  });
  it("0 days means only on the day itself", () => {
    expect(dueReminders([planned({ remindDaysBefore: 0 })], "2026-11-27")).toEqual([]);
    expect(dueReminders([planned({ remindDaysBefore: 0 })], "2026-11-28")).toHaveLength(1);
  });
  it("ignores inactive schedules", () => {
    expect(dueReminders([planned({ isActive: false })], "2026-11-28")).toEqual([]);
  });
});

describe("calendar file", () => {
  it("escapes special characters", () => {
    expect(icsEscape("a,b;c\\d\ne")).toBe("a\\,b\\;c\\\\d\\ne");
  });
  it("folds long lines at 75 bytes without breaking characters", () => {
    const folded = icsFold("SUMMARY:" + "Зарплата ".repeat(20));
    const lines = folded.split("\r\n");
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.every((l) => new TextEncoder().encode(l).length <= 75)).toBe(true);
    expect(lines.slice(1).every((l) => l.startsWith(" "))).toBe(true);
    expect(folded.replace(/\r\n /g, "")).toBe("SUMMARY:" + "Зарплата ".repeat(20));
  });
  it("builds events with an alarm", () => {
    const ics = buildIcs(
      [
        { uid: "x-1@kapio", date: "2026-11-28", summary: "Salary, main", remindDaysBefore: 2 },
        { uid: "x-2@kapio", date: "2026-12-28", summary: "Salary", remindDaysBefore: 0 },
      ],
      "Kapio",
      new Date(Date.UTC(2026, 10, 22, 8, 30, 0)),
    );
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("DTSTART;VALUE=DATE:20261128");
    expect(ics).toContain("DTEND;VALUE=DATE:20261129");
    expect(ics).toContain("SUMMARY:Salary\\, main");
    expect(ics).toContain("DTSTAMP:20261122T083000Z");
    expect(ics).toContain("TRIGGER:-P2D");
    expect(ics).toContain("TRIGGER:PT9H");
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
  });
});

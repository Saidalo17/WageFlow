import { and, asc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { salarySchedules } from "@/lib/db/schema";
import type { Frequency } from "@/lib/salary-schedule";

/**
 * Every function takes the signed-in user's id and puts it in the WHERE clause,
 * so one user can never read or change another user's pay schedules.
 */

export type ScheduleRow = {
  id: string;
  currency: string;
  title: string;
  frequency: Frequency;
  dayOfMonth: number;
  anchorDate: string | null;
  expectedNet: number;
  remindDaysBefore: number;
  isActive: boolean;
};

export type ScheduleValues = Omit<ScheduleRow, "id">;

const columns = {
  id: salarySchedules.id,
  currency: salarySchedules.currency,
  title: salarySchedules.title,
  frequency: salarySchedules.frequency,
  dayOfMonth: salarySchedules.dayOfMonth,
  anchorDate: salarySchedules.anchorDate,
  expectedNet: salarySchedules.expectedNet,
  remindDaysBefore: salarySchedules.remindDaysBefore,
  isActive: salarySchedules.isActive,
};

/** Hard limit per user, so the list (and the calendar file) stays small. */
export const MAX_SCHEDULES = 20;

export async function listSchedules(userId: string): Promise<ScheduleRow[]> {
  return db
    .select(columns)
    .from(salarySchedules)
    .where(eq(salarySchedules.userId, userId))
    .orderBy(asc(salarySchedules.createdAt));
}

export async function insertSchedule(userId: string, v: ScheduleValues): Promise<string> {
  const [row] = await db
    .insert(salarySchedules)
    .values({ ...v, userId })
    .returning({ id: salarySchedules.id });
  return row.id;
}

export async function updateSchedule(userId: string, id: string, v: ScheduleValues): Promise<boolean> {
  const res = await db
    .update(salarySchedules)
    .set(v)
    .where(and(eq(salarySchedules.id, id), eq(salarySchedules.userId, userId)));
  return res.rowsAffected > 0;
}

export async function deleteSchedule(userId: string, id: string): Promise<boolean> {
  const res = await db
    .delete(salarySchedules)
    .where(and(eq(salarySchedules.id, id), eq(salarySchedules.userId, userId)));
  return res.rowsAffected > 0;
}

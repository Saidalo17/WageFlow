import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { deleteSchedule, insertSchedule, listSchedules, updateSchedule, type ScheduleValues } from "@/lib/services/schedules";
import { createTestUser } from "../helpers/db";

const monthly = (title: string, day: number): ScheduleValues => ({
  currency: "USD",
  title,
  frequency: "monthly",
  dayOfMonth: day,
  anchorDate: null,
  expectedNet: 250_000,
  remindDaysBefore: 2,
  isActive: true,
});

describe("pay schedules", () => {
  let A: Awaited<ReturnType<typeof createTestUser>>;
  let B: Awaited<ReturnType<typeof createTestUser>>;
  let firstId: string;

  beforeAll(async () => {
    A = await createTestUser("sched-a");
    B = await createTestUser("sched-b");
    firstId = await insertSchedule(A.id, monthly("Main job", 28));
    await insertSchedule(A.id, {
      ...monthly("Side", 1),
      frequency: "biweekly",
      anchorDate: "2026-11-06",
      expectedNet: 50_000,
    });
  });

  it("lists a user's schedules in the order they were made", async () => {
    const rows = await listSchedules(A.id);
    expect(rows.map((r) => r.title)).toEqual(["Main job", "Side"]);
    expect(rows[1]).toMatchObject({ frequency: "biweekly", anchorDate: "2026-11-06", isActive: true });
  });

  it("never shows, changes or deletes another user's schedules", async () => {
    expect(await listSchedules(B.id)).toEqual([]);
    expect(await updateSchedule(B.id, firstId, monthly("Hacked", 1))).toBe(false);
    expect(await deleteSchedule(B.id, firstId)).toBe(false);
    expect((await listSchedules(A.id)).map((r) => r.title)).toEqual(["Main job", "Side"]);
  });

  it("updates one schedule", async () => {
    expect(await updateSchedule(A.id, firstId, { ...monthly("Main job", 15), isActive: false })).toBe(true);
    const row = (await listSchedules(A.id)).find((r) => r.id === firstId)!;
    expect(row).toMatchObject({ dayOfMonth: 15, isActive: false });
  });

  it("deletes one schedule, and removes them all with the account", async () => {
    expect(await deleteSchedule(A.id, firstId)).toBe(true);
    expect(await deleteSchedule(A.id, firstId)).toBe(false);
    expect(await listSchedules(A.id)).toHaveLength(1);
    await db.delete(users).where(eq(users.id, A.id));
    expect(await listSchedules(A.id)).toEqual([]);
  });
});

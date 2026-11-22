import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db/client";
import { salaryBonuses, users } from "@/lib/db/schema";
import { calculateSalary } from "@/lib/salary";
import {
  deleteSalaryRecord,
  insertSalaryRecord,
  listSalaryRecords,
  salaryMonthlyTotals,
} from "@/lib/services/salary";
import { createTestUser } from "../helpers/db";

const input = {
  mode: "monthly" as const,
  rate: 300000,
  quantity: 0,
  monthHours: 16000,
  dayHours: 800,
  overtimeHours: 1000,
  overtimeMultiplier: 150,
  bonuses: [{ label: "Quarterly", amount: 50000 }],
  deductions: [{ label: "Tax", kind: "percent" as const, value: 1300 }],
};

function values(payDate: string, title: string | null = null) {
  const result = calculateSalary({ ...input, bonuses: input.bonuses.map((b) => b.amount) });
  return { ...input, currency: "USD", country: null, title, payDate, result };
}

describe("salary records", () => {
  let A: Awaited<ReturnType<typeof createTestUser>>;
  let B: Awaited<ReturnType<typeof createTestUser>>;
  let firstId: string;

  beforeAll(async () => {
    A = await createTestUser("salary-a");
    B = await createTestUser("salary-b");
    firstId = await insertSalaryRecord(A.id, values("2026-10-31", "October"));
    await insertSalaryRecord(A.id, values("2026-11-30", "November"));
  });

  it("stores the calculated numbers and lists newest first with their bonuses", async () => {
    const rows = await listSalaryRecords(A.id);
    expect(rows.map((r) => r.title)).toEqual(["November", "October"]);
    const r = rows[0];
    expect(r.gross).toBe(378125); // 3000 + 281.25 overtime + 500 bonus
    expect(r.net).toBe(r.gross - r.deductionTotal);
    expect(r.bonuses).toHaveLength(1);
    expect(r.bonuses[0]).toMatchObject({ label: "Quarterly", amount: 50000 });
  });

  it("adds records up per month, for one currency and one user", async () => {
    await insertSalaryRecord(A.id, values("2026-11-10", "Advance"));
    await insertSalaryRecord(A.id, { ...values("2026-11-12", "Euro"), currency: "EUR" });
    const totals = await salaryMonthlyTotals(A.id, "USD", "2026-01");
    expect(totals.map((t) => [t.month, t.count])).toEqual([
      ["2026-10", 1],
      ["2026-11", 2],
    ]);
    const nov = totals[1];
    expect(nov.gross).toBe(2 * 378125);
    expect(nov.bonus).toBe(2 * 50000);
    expect(nov.net).toBe(nov.gross - nov.deductions);
    // Only records from the start month on, and nothing of other users or currencies.
    expect((await salaryMonthlyTotals(A.id, "USD", "2026-11")).map((t) => t.month)).toEqual(["2026-11"]);
    expect(await salaryMonthlyTotals(B.id, "USD", "2026-01")).toEqual([]);
    expect((await salaryMonthlyTotals(A.id, "EUR", "2026-01")).map((t) => t.count)).toEqual([1]);
  });

  it("never shows or deletes another user's records", async () => {
    expect(await listSalaryRecords(B.id)).toEqual([]);
    expect(await deleteSalaryRecord(B.id, firstId)).toBe(false);
    expect(await listSalaryRecords(A.id)).toHaveLength(4);
  });

  it("deleting a record removes its bonuses too", async () => {
    expect(await deleteSalaryRecord(A.id, firstId)).toBe(true);
    const left = await db.select().from(salaryBonuses).where(eq(salaryBonuses.userId, A.id));
    expect(left).toHaveLength(3);
    expect(await deleteSalaryRecord(A.id, firstId)).toBe(false);
  });

  it("deleting the account removes the salary records", async () => {
    await db.delete(users).where(eq(users.id, A.id));
    expect(await listSalaryRecords(A.id)).toEqual([]);
  });
});

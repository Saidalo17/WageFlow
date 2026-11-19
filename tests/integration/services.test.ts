import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db/client";
import { isForeignKeyViolation, isUniqueViolation } from "@/lib/db/errors";
import { loginAttempts } from "@/lib/db/schema";
import { attemptKeys, clearFailures, isRateLimited, recordFailure } from "@/lib/rate-limit";
import { incomeExpenseSeries, totalsByCategory } from "@/lib/services/analytics";
import {
  deleteBudgetRow,
  getBudget,
  insertBudget,
  listBudgets,
  updateBudgetLimit,
} from "@/lib/services/budgets";
import {
  countCategoryTransactions,
  deleteCategoryRow,
  getCategory,
  insertCategory,
  listCategories,
  listCategoriesWithTotals,
  setCategoryArchived,
  updateCategoryRow,
} from "@/lib/services/categories";
import {
  deleteTransactionRow,
  exportTransactions,
  getTransaction,
  insertTransaction,
  listTransactions,
  sumTransactions,
  updateTransactionRow,
} from "@/lib/services/transactions";
import { createTestUser } from "../helpers/db";

type Tx = { type: "income" | "expense"; amount: number; occurredOn: string; note?: string | null };

describe("transactions", () => {
  let A: Awaited<ReturnType<typeof createTestUser>>;
  const add = (t: Tx, key = "food") =>
    insertTransaction(A.id, { type: t.type, categoryId: A.cat[key], amount: t.amount, occurredOn: t.occurredOn, note: t.note ?? null });

  beforeAll(async () => {
    A = await createTestUser("tx");
    await add({ type: "expense", amount: 12500, occurredOn: "2026-11-10", note: "Обед с другом" });
    await add({ type: "expense", amount: 5000, occurredOn: "2026-11-10", note: "100% органик" });
    await add({ type: "expense", amount: 900, occurredOn: "2026-11-12", note: "snake_case" }, "transport");
    await add({ type: "income", amount: 500000, occurredOn: "2026-11-01", note: "Зарплата" }, "salary");
    await add({ type: "expense", amount: 7700, occurredOn: "2026-10-05" }, "transport");
  });

  it("lists newest first and reports totals for the same filters", async () => {
    const { items } = await listTransactions(A.id, {}, 50);
    expect(items.map((i) => i.occurredOn)).toEqual(["2026-11-12", "2026-11-10", "2026-11-10", "2026-11-01", "2026-10-05"]);
    expect(await sumTransactions(A.id, {})).toEqual({ income: 500000, expense: 26100 });
  });

  it("filters by type, category and dates", async () => {
    expect((await listTransactions(A.id, { type: "income" }, 50)).items).toHaveLength(1);
    expect((await listTransactions(A.id, { categoryId: A.cat.transport }, 50)).items).toHaveLength(2);
    const nov = { from: "2026-11-01", to: "2026-11-30" };
    expect((await listTransactions(A.id, nov, 50)).items).toHaveLength(4);
    expect(await sumTransactions(A.id, nov)).toEqual({ income: 500000, expense: 18400 });
    expect(await sumTransactions(A.id, { from: "2026-12-01" })).toEqual({ income: 0, expense: 0 });
  });

  it("searches notes, ignoring letter case for Cyrillic", async () => {
    expect((await listTransactions(A.id, { q: "обед" }, 50)).items).toHaveLength(1);
    expect((await listTransactions(A.id, { q: "ОБЕД" }, 50)).items).toHaveLength(1);
    expect((await listTransactions(A.id, { q: "зарплата" }, 50)).items).toHaveLength(1);
    expect((await listTransactions(A.id, { q: "nothing-like-this" }, 50)).items).toHaveLength(0);
  });

  it("treats % and _ in the search text literally", async () => {
    expect((await listTransactions(A.id, { q: "100%" }, 50)).items).toHaveLength(1);
    expect((await listTransactions(A.id, { q: "%" }, 50)).items).toHaveLength(1); // only the note that really has a %
    expect((await listTransactions(A.id, { q: "snake_case" }, 50)).items).toHaveLength(1);
    expect((await listTransactions(A.id, { q: "snake-case" }, 50)).items).toHaveLength(0);
  });

  it("matches the translated name of a standard category", async () => {
    // The page passes the system keys whose *translated* name contains the text.
    const { items } = await listTransactions(A.id, { q: "ед", systemKeys: ["food"] }, 50);
    expect(items.every((i) => i.categorySystemKey === "food")).toBe(true);
    expect(items.length).toBeGreaterThanOrEqual(2);
  });

  it("pages results and says whether there is more", async () => {
    const first = await listTransactions(A.id, {}, 2);
    expect(first.items).toHaveLength(2);
    expect(first.hasMore).toBe(true);
    const all = await listTransactions(A.id, {}, 5);
    expect(all.hasMore).toBe(false);
  });

  it("updates and deletes", async () => {
    const { id } = (await add({ type: "expense", amount: 100, occurredOn: "2026-11-15", note: "tmp" }))!;
    expect(await updateTransactionRow(A.id, id, { type: "expense", categoryId: A.cat.health, amount: 250, occurredOn: "2026-11-16", note: null })).toBe(true);
    const row = await getTransaction(A.id, id);
    expect(row).toMatchObject({ amount: 250, occurredOn: "2026-11-16", note: null, categoryId: A.cat.health });
    expect(await deleteTransactionRow(A.id, id)).toBe(true);
    expect(await getTransaction(A.id, id)).toBeNull();
    expect(await deleteTransactionRow(A.id, id)).toBe(false);
  });

  it("can put a deleted transaction back with the same id (Undo)", async () => {
    const created = (await add({ type: "expense", amount: 321, occurredOn: "2026-11-17" }))!;
    await deleteTransactionRow(A.id, created.id);
    await insertTransaction(A.id, { type: "expense", categoryId: A.cat.food, amount: 321, occurredOn: "2026-11-17", note: null }, created.id);
    expect(await getTransaction(A.id, created.id)).toMatchObject({ amount: 321 });
  });

  it("exports everything oldest first, optionally limited by date", async () => {
    const all = await exportTransactions(A.id, {});
    const dates = all.map((r) => r.occurredOn);
    expect(dates).toEqual([...dates].sort());
    const limited = await exportTransactions(A.id, { from: "2026-11-01", to: "2026-11-11" });
    expect(limited.every((r) => r.occurredOn >= "2026-11-01" && r.occurredOn <= "2026-11-11")).toBe(true);
  });
});

describe("categories", () => {
  it("lists categories with this period's totals", async () => {
    const u = await createTestUser("cat");
    await insertTransaction(u.id, { type: "expense", categoryId: u.cat.food, amount: 1000, occurredOn: "2026-11-05", note: null });
    await insertTransaction(u.id, { type: "expense", categoryId: u.cat.food, amount: 500, occurredOn: "2026-10-05", note: null });
    const rows = await listCategoriesWithTotals(u.id, { from: "2026-11-01", to: "2026-11-30" });
    expect(rows).toHaveLength(12);
    expect(rows.find((r) => r.systemKey === "food")?.total).toBe(1000);
    expect(rows.find((r) => r.systemKey === "transport")?.total).toBe(0);
  });

  it("creates, edits, archives and deletes", async () => {
    const u = await createTestUser("cat");
    const created = (await insertCategory(u.id, { name: "Coffee", type: "expense", color: "#EC4899", icon: "coffee" }))!;
    expect(await updateCategoryRow(u.id, created.id, { name: "Tea", color: "#10B981", icon: "coffee" })).toBe(true);
    expect(await getCategory(u.id, created.id)).toMatchObject({ name: "Tea", color: "#10B981", isArchived: false });
    expect(await setCategoryArchived(u.id, created.id, true)).toBe(true);
    expect((await listCategories(u.id)).find((c) => c.id === created.id)?.isArchived).toBe(true);
    expect(await deleteCategoryRow(u.id, created.id)).toBe(true);
    expect(await getCategory(u.id, created.id)).toBeNull();
  });

  it("does not allow two categories with the same name and type", async () => {
    const u = await createTestUser("cat");
    await insertCategory(u.id, { name: "Pets", type: "expense", color: "#10B981", icon: "paw-print" });
    await expect(insertCategory(u.id, { name: "Pets", type: "expense", color: "#10B981", icon: "paw-print" })).rejects.toSatisfy(isUniqueViolation);
    // the same name is fine for the other type
    await expect(insertCategory(u.id, { name: "Pets", type: "income", color: "#10B981", icon: "paw-print" })).resolves.toBeTruthy();
  });

  it("refuses to delete a category that has transactions", async () => {
    const u = await createTestUser("cat");
    await insertTransaction(u.id, { type: "expense", categoryId: u.cat.food, amount: 100, occurredOn: "2026-11-05", note: null });
    expect(await countCategoryTransactions(u.id, u.cat.food)).toBe(1);
    await expect(deleteCategoryRow(u.id, u.cat.food)).rejects.toSatisfy(isForeignKeyViolation);
    expect(await getCategory(u.id, u.cat.food)).not.toBeNull();
  });
});

describe("budgets", () => {
  it("counts only this period's expenses of the budget's category", async () => {
    const u = await createTestUser("bud");
    const period = { from: "2026-11-01", to: "2026-11-30" };
    await insertBudget(u.id, u.cat.food, 100000);
    const t = (key: string, type: "income" | "expense", amount: number, date: string) =>
      insertTransaction(u.id, { type, categoryId: u.cat[key], amount, occurredOn: date, note: null });
    await t("food", "expense", 30000, "2026-11-03");
    await t("food", "expense", 20000, "2026-11-30");
    await t("food", "expense", 99999, "2026-10-31"); // last month
    await t("food", "expense", 88888, "2026-12-01"); // next month
    await t("transport", "expense", 7777, "2026-11-04"); // other category
    const [row] = await listBudgets(u.id, period);
    expect(row).toMatchObject({ limit: 100000, spent: 50000, categoryId: u.cat.food });
  });

  it("shows zero spent when nothing was spent", async () => {
    const u = await createTestUser("bud");
    await insertBudget(u.id, u.cat.health, 5000);
    expect((await listBudgets(u.id, { from: "2026-11-01", to: "2026-11-30" }))[0].spent).toBe(0);
  });

  it("allows one limit per category, and can change and remove it", async () => {
    const u = await createTestUser("bud");
    const b = (await insertBudget(u.id, u.cat.shopping, 1000))!;
    await expect(insertBudget(u.id, u.cat.shopping, 2000)).rejects.toSatisfy(isUniqueViolation);
    expect(await updateBudgetLimit(u.id, b.id, 4000)).toBe(true);
    expect((await getBudget(u.id, b.id))?.limitAmount).toBe(4000);
    expect(await deleteBudgetRow(u.id, b.id)).toBe(true);
    expect(await getBudget(u.id, b.id)).toBeNull();
  });
});

describe("analytics", () => {
  let u: Awaited<ReturnType<typeof createTestUser>>;
  beforeAll(async () => {
    u = await createTestUser("ana");
    const t = (key: string, type: "income" | "expense", amount: number, date: string) =>
      insertTransaction(u.id, { type, categoryId: u.cat[key], amount, occurredOn: date, note: null });
    await t("food", "expense", 1000, "2026-11-02");
    await t("food", "expense", 500, "2026-11-02");
    await t("salary", "income", 90000, "2026-11-04");
    await t("transport", "expense", 2500, "2026-10-20");
    await t("food", "expense", 300, "2026-09-10");
  });

  it("fills empty days with zeros so a chart line never breaks", async () => {
    const series = await incomeExpenseSeries(u.id, "2026-11-01", "2026-11-05", "day");
    expect(series).toEqual([
      { date: "2026-11-01", income: 0, expense: 0 },
      { date: "2026-11-02", income: 0, expense: 1500 },
      { date: "2026-11-03", income: 0, expense: 0 },
      { date: "2026-11-04", income: 90000, expense: 0 },
      { date: "2026-11-05", income: 0, expense: 0 },
    ]);
  });

  it("groups by month, including months with no data", async () => {
    const series = await incomeExpenseSeries(u.id, "2026-08-01", "2026-11-30", "month");
    expect(series.map((p) => p.date)).toEqual(["2026-08", "2026-09", "2026-10", "2026-11"]);
    expect(series.map((p) => p.expense)).toEqual([0, 300, 2500, 1500]);
    expect(series.map((p) => p.income)).toEqual([0, 0, 0, 90000]);
  });

  it("totals expenses per category, biggest first", async () => {
    const rows = await totalsByCategory(u.id, "expense", "2026-09-01", "2026-11-30");
    expect(rows.map((r) => [r.systemKey, r.total])).toEqual([["transport", 2500], ["food", 1800]]);
    expect(await totalsByCategory(u.id, "income", "2026-09-01", "2026-11-30")).toHaveLength(1);
    expect(await totalsByCategory(u.id, "expense", "2025-01-01", "2025-01-31")).toEqual([]);
  });
});

describe("sign-in rate limit", () => {
  it("blocks after 5 failures and unblocks on success", async () => {
    const keys = attemptKeys(`blocked-${Date.now()}@example.test`, "203.0.113.9");
    expect(keys).toHaveLength(2);
    for (let i = 0; i < 4; i++) await recordFailure(keys);
    expect(await isRateLimited(keys)).toBe(false);
    await recordFailure(keys);
    expect(await isRateLimited(keys)).toBe(true);
    await clearFailures(keys);
    expect(await isRateLimited(keys)).toBe(false);
  });

  it("forgets failures older than 15 minutes", async () => {
    const key = `email:old-${Date.now()}@example.test`;
    await db.insert(loginAttempts).values(Array.from({ length: 5 }, () => ({ key, createdAt: Date.now() - 16 * 60 * 1000 })));
    expect(await isRateLimited([key])).toBe(false);
  });

  it("counts an email and an IP address separately", async () => {
    const ip = `ip:198.51.100.${Math.floor(Math.random() * 200)}`;
    for (let i = 0; i < 5; i++) await recordFailure([ip]);
    expect(await isRateLimited([ip])).toBe(true);
    expect(await isRateLimited(["email:someone-else@example.test"])).toBe(false);
    expect(await isRateLimited(["email:someone-else@example.test", ip])).toBe(true); // either one is enough
  });
});

describe("data of one user is invisible to another", () => {
  it("cannot read, change or delete the other user's data", async () => {
    const a = await createTestUser("iso-a");
    const b = await createTestUser("iso-b");
    const tx = (await insertTransaction(b.id, { type: "expense", categoryId: b.cat.food, amount: 4200, occurredOn: "2026-11-05", note: "private" }))!;
    const bud = (await insertBudget(b.id, b.cat.food, 9000))!;

    expect(await getTransaction(a.id, tx.id)).toBeNull();
    expect((await listTransactions(a.id, {}, 50)).items).toHaveLength(0);
    expect(await sumTransactions(a.id, {})).toEqual({ income: 0, expense: 0 });
    expect(await updateTransactionRow(a.id, tx.id, { type: "expense", categoryId: b.cat.food, amount: 1, occurredOn: "2026-11-06", note: "hacked" })).toBe(false);
    expect(await deleteTransactionRow(a.id, tx.id)).toBe(false);

    expect(await getCategory(a.id, b.cat.food)).toBeNull();
    expect(await setCategoryArchived(a.id, b.cat.food, true)).toBe(false);
    expect(await updateCategoryRow(a.id, b.cat.food, { name: "x", color: "#EF4444", icon: "gem" })).toBe(false);
    expect(await countCategoryTransactions(a.id, b.cat.food)).toBe(0);

    const period = { from: "2026-11-01", to: "2026-11-30" };
    expect(await listBudgets(a.id, period)).toHaveLength(0);
    expect(await getBudget(a.id, bud.id)).toBeNull();
    expect(await updateBudgetLimit(a.id, bud.id, 1)).toBe(false);
    expect(await deleteBudgetRow(a.id, bud.id)).toBe(false);
    expect(await exportTransactions(a.id, {})).toEqual([]);
    expect(await totalsByCategory(a.id, "expense", "2026-01-01", "2026-12-31")).toEqual([]);

    // ... and B's data is exactly as it was
    expect(await getTransaction(b.id, tx.id)).toMatchObject({ amount: 4200, note: "private" });
    expect((await listBudgets(b.id, period))[0]).toMatchObject({ limit: 9000, spent: 4200 });
  });
});

import { beforeAll, describe, expect, it } from "vitest";
import { buildLearning, suggest } from "@/lib/import/categorize";
import { existingBetween, insertImported, loadLearningHistory } from "@/lib/services/import";
import { listTransactions } from "@/lib/services/transactions";
import { createTestUser } from "../helpers/db";

describe("statement import", () => {
  let A: Awaited<ReturnType<typeof createTestUser>>;
  let B: Awaited<ReturnType<typeof createTestUser>>;

  beforeAll(async () => {
    A = await createTestUser("import-a");
    B = await createTestUser("import-b");
  });

  it("adds the rows as the user's own transactions, in the main currency", async () => {
    const count = await insertImported(A.id, "USD", [
      { date: "2026-11-05", note: "CORNER SHOP 12", amount: 450, type: "expense", categoryId: A.cat.food },
      { date: "2026-11-06", note: "Salary November", amount: 300_000, type: "income", categoryId: A.cat.salary },
      { date: "2026-11-06", note: null, amount: 99, type: "expense", categoryId: A.cat.transport },
    ]);
    expect(count).toBe(3);

    const list = await listTransactions(A.id, {}, 50);
    expect(list.items).toHaveLength(3);
    const shop = list.items.find((i) => i.note === "CORNER SHOP 12")!;
    expect(shop).toMatchObject({ amount: 450, type: "expense", occurredOn: "2026-11-05" });
    // Nothing leaks to another user.
    expect((await listTransactions(B.id, {}, 50)).items).toEqual([]);
  });

  it("handles more rows than one insert chunk", async () => {
    const rows = Array.from({ length: 250 }, (_, i) => ({
      date: "2026-10-01",
      note: `Bulk ${i}`,
      amount: 100 + i,
      type: "expense" as const,
      categoryId: A.cat.food,
    }));
    expect(await insertImported(A.id, "USD", rows)).toBe(250);
    const found = await existingBetween(A.id, "2026-10-01", "2026-10-01");
    expect(found).toHaveLength(250);
  });

  it("finds existing operations by date range, for duplicate detection", async () => {
    const found = await existingBetween(A.id, "2026-11-05", "2026-11-06");
    expect(found.map((f) => [f.occurredOn, f.type, f.amount]).sort()).toEqual([
      ["2026-11-05", "expense", 450],
      ["2026-11-06", "expense", 99],
      ["2026-11-06", "income", 300_000],
    ]);
    expect(await existingBetween(B.id, "2026-01-01", "2026-12-31")).toEqual([]);
  });

  it("learns from earlier operations: the next import suggests the same category", async () => {
    const history = await loadLearningHistory(A.id);
    expect(history.length).toBeGreaterThan(0);
    const learning = buildLearning(history);
    expect(suggest("Corner Shop 99", "expense", learning)).toMatchObject({ source: "history", categoryId: A.cat.food });
    expect(suggest("Corner Shop 99", "expense", buildLearning(await loadLearningHistory(B.id))).source).not.toBe("history");
  });
});

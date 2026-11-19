import { config } from "dotenv"; config({ path: ".env.local" });

// Data isolation check: user A must never see or change user B's categories and transactions.
async function main() {
  const { db } = await import("../src/lib/db/client");
  const { users, categories, transactions, budgets } = await import("../src/lib/db/schema");
  const cat = await import("../src/lib/services/categories");
  const tx = await import("../src/lib/services/transactions");
  const bud = await import("../src/lib/services/budgets");
  const { eq, inArray } = await import("drizzle-orm");

  const A = crypto.randomUUID(), B = crypto.randomUUID(), catB = crypto.randomUUID(), txB = crypto.randomUUID(), budB = crypto.randomUUID();
  const ids = [A, B];
  const results: [string, boolean][] = [];
  const check = (name: string, ok: boolean) => results.push([name, ok]);
  try {
    await db.insert(users).values([
      { id: A, email: `claude-test-iso-a-${Date.now()}@example.test`, passwordHash: "x" },
      { id: B, email: `claude-test-iso-b-${Date.now()}@example.test`, passwordHash: "x" },
    ]);
    await db.insert(categories).values({ id: catB, userId: B, name: "Secret", type: "expense", color: "#6366F1", icon: "home" });
    await db.insert(transactions).values({ id: txB, userId: B, categoryId: catB, type: "expense", amount: 12345, occurredOn: "2026-11-01", note: "private" });

    await db.insert(budgets).values({ id: budB, userId: B, categoryId: catB, limitAmount: 50000 });

    check("A cannot read B's transaction", (await tx.getTransaction(A, txB)) === null);
    check("A's list excludes B's data", (await tx.listTransactions(A, {}, 50)).items.length === 0);
    check("A's totals exclude B's data", (await tx.sumTransactions(A, {})).expense === 0);
    check("A cannot update B's transaction", (await tx.updateTransactionRow(A, txB, { type: "expense", categoryId: catB, amount: 1, occurredOn: "2026-11-02", note: "hacked" })) === false);
    check("A cannot delete B's transaction", (await tx.deleteTransactionRow(A, txB)) === false);
    check("A cannot read B's category", (await cat.getCategory(A, catB)) === null);
    check("A's category list excludes B's", (await cat.listCategories(A)).length === 0);
    check("A cannot archive B's category", (await cat.setCategoryArchived(A, catB, true)) === false);
    check("A cannot edit B's category", (await cat.updateCategoryRow(A, catB, { color: "#EF4444", icon: "gem", name: "x" })) === false);
    check("A cannot delete B's category", (await cat.deleteCategoryRow(A, catB)) === false);
    check("A cannot count B's transactions", (await cat.countCategoryTransactions(A, catB)) === 0);

    const period = { from: "2026-11-01", to: "2026-11-30" };
    check("A's budget list excludes B's", (await bud.listBudgets(A, period)).length === 0);
    check("A cannot read B's budget", (await bud.getBudget(A, budB)) === null);
    check("A cannot change B's budget", (await bud.updateBudgetLimit(A, budB, 1)) === false);
    check("A cannot delete B's budget", (await bud.deleteBudgetRow(A, budB)) === false);
    const bList = await bud.listBudgets(B, period);
    check("B's budget is untouched and counts B's spending", bList.length === 1 && bList[0].limit === 50000 && bList[0].spent === 12345);

    const intact = await tx.getTransaction(B, txB);
    check("B's data is untouched", intact?.note === "private" && intact.amount === 12345);
    check("B can read own data", (await tx.listTransactions(B, {}, 50)).items.length === 1);
  } finally {
    await db.delete(budgets).where(inArray(budgets.userId, ids));
    await db.delete(transactions).where(inArray(transactions.userId, ids));
    await db.delete(users).where(inArray(users.id, ids));
  }
  for (const [name, ok] of results) console.log(ok ? "PASS" : "FAIL", name);
  if (results.some(([, ok]) => !ok)) process.exit(1);
}
main().catch((e) => { console.error(e); process.exit(1); });

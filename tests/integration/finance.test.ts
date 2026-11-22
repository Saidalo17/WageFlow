import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db/client";
import { transactions, users } from "@/lib/db/schema";
import { deleteAccount, findAccount, getAccount, insertAccount, listAccountOptions, listAccounts, setOpeningBalance, updateAccount } from "@/lib/services/accounts";
import { deleteDebt, deletePayment, getDebt, insertDebt, insertPayment, listDebts, listPayments, updateDebt } from "@/lib/services/debts";
import { listSnapshots, loadNetWorth, upsertSnapshot } from "@/lib/services/net-worth";
import { deleteTransactionRow, insertTransaction } from "@/lib/services/transactions";
import { createTestUser } from "../helpers/db";

const account = (name: string, currency = "USD", opening = 0) => ({
  name,
  kind: "checking" as const,
  currency,
  openingBalance: opening,
  inNetWorth: true,
  isArchived: false,
});

describe("accounts", () => {
  let A: Awaited<ReturnType<typeof createTestUser>>;
  let B: Awaited<ReturnType<typeof createTestUser>>;
  let bankId: string;
  let euroId: string;

  const tx = (accountId: string | null, type: "income" | "expense", amount: number, currency = "USD", date = "2026-11-10") =>
    insertTransaction(A.id, {
      type,
      categoryId: type === "income" ? A.cat.salary : A.cat.food,
      accountId,
      amount,
      originalAmount: amount,
      originalCurrency: currency,
      occurredOn: date,
      note: null,
    });

  beforeAll(async () => {
    A = await createTestUser("acc-a");
    B = await createTestUser("acc-b");
    bankId = await insertAccount(A.id, account("Bank", "USD", 100_000));
    euroId = await insertAccount(A.id, account("Euro savings", "EUR", 0));
  });

  it("balance = opening balance + linked income - linked expenses, in the account's currency", async () => {
    await tx(bankId, "income", 50_000);
    await tx(bankId, "expense", 12_000);
    await tx(bankId, "expense", 3_000);
    const bank = (await getAccount(A.id, bankId))!;
    expect(bank).toMatchObject({ openingBalance: 100_000, linked: 35_000, balance: 135_000 });
  });

  it("transactions in another currency, or without an account, do not touch the balance", async () => {
    await tx(bankId, "expense", 99_999, "EUR"); // wrong currency for a USD account: not counted
    await tx(null, "expense", 7_000);
    expect((await getAccount(A.id, bankId))!.balance).toBe(135_000);
    await tx(euroId, "income", 20_000, "EUR");
    expect((await getAccount(A.id, euroId))!.balance).toBe(20_000);
  });

  it("deleting a transaction changes the balance back", async () => {
    const id = (await tx(bankId, "income", 1_000))!.id;
    expect((await getAccount(A.id, bankId))!.balance).toBe(136_000);
    await deleteTransactionRow(A.id, id);
    expect((await getAccount(A.id, bankId))!.balance).toBe(135_000);
  });

  it("setting the balance moves the opening balance, not the transactions", async () => {
    const before = (await getAccount(A.id, bankId))!;
    await setOpeningBalance(A.id, bankId, 500_000 - before.linked);
    expect((await getAccount(A.id, bankId))!.balance).toBe(500_000);
  });

  it("an account can be renamed and archived; the options list is light", async () => {
    expect(await updateAccount(A.id, euroId, { name: "Euro", kind: "savings", openingBalance: 0, inNetWorth: false, isArchived: true })).toBe(true);
    const options = await listAccountOptions(A.id);
    expect(options.find((o) => o.id === euroId)).toMatchObject({ name: "Euro", isArchived: true, currency: "EUR" });
    expect(await findAccount(A.id, euroId)).not.toBeNull();
  });

  it("never shows or changes another user's accounts", async () => {
    expect(await listAccounts(B.id)).toEqual([]);
    expect(await findAccount(B.id, bankId)).toBeNull();
    expect(await updateAccount(B.id, bankId, account("Hacked"))).toBe(false);
    expect(await setOpeningBalance(B.id, bankId, 1)).toBe(false);
    expect(await deleteAccount(B.id, bankId)).toBe(false);
  });

  it("deleting an account keeps its transactions, unlinked", async () => {
    const before = await db.select().from(transactions).where(eq(transactions.accountId, bankId));
    expect(before.length).toBeGreaterThan(0);
    expect(await deleteAccount(A.id, bankId)).toBe(true);
    const after = await db.select().from(transactions).where(eq(transactions.userId, A.id));
    expect(after.length).toBeGreaterThanOrEqual(before.length);
    expect(after.some((t) => t.accountId === bankId)).toBe(false);
    expect(await getAccount(A.id, bankId)).toBeNull();
  });
});

describe("debts", () => {
  let A: Awaited<ReturnType<typeof createTestUser>>;
  let B: Awaited<ReturnType<typeof createTestUser>>;
  let loanId: string;

  const debt = (name: string, over = {}) => ({
    name,
    direction: "owed_by_me" as const,
    kind: "loan" as const,
    currency: "USD",
    principal: 1_000_000,
    interestRate: 1200,
    monthlyPayment: 100_000,
    paymentDay: 15,
    note: null,
    ...over,
  });

  beforeAll(async () => {
    A = await createTestUser("debt-a");
    B = await createTestUser("debt-b");
    loanId = await insertDebt(A.id, debt("Car loan"));
  });

  it("the paid amount is the sum of the payments", async () => {
    await insertPayment(A.id, loanId, "2026-10-15", 100_000, null);
    await insertPayment(A.id, loanId, "2026-11-15", 100_000, "November");
    const d = (await getDebt(A.id, loanId))!;
    expect(d.paid).toBe(200_000);
    expect(d).toMatchObject({ principal: 1_000_000, interestRate: 1200, paymentDay: 15 });
  });

  it("lists payments newest first and can remove one", async () => {
    const list = await listPayments(A.id);
    expect(list.map((p) => p.paidOn)).toEqual(["2026-11-15", "2026-10-15"]);
    expect(await deletePayment(A.id, list[0].id)).toBe(true);
    expect((await getDebt(A.id, loanId))!.paid).toBe(100_000);
  });

  it("a debt can be changed", async () => {
    expect(await updateDebt(A.id, loanId, { ...debt("Car loan 2"), monthlyPayment: null })).toBe(true);
    expect(await getDebt(A.id, loanId)).toMatchObject({ name: "Car loan 2", monthlyPayment: null });
  });

  it("never shows or changes another user's debts or payments", async () => {
    expect(await listDebts(B.id)).toEqual([]);
    expect(await getDebt(B.id, loanId)).toBeNull();
    expect(await updateDebt(B.id, loanId, debt("Hacked"))).toBe(false);
    expect(await deleteDebt(B.id, loanId)).toBe(false);
    const pay = (await listPayments(A.id))[0];
    expect(await deletePayment(B.id, pay.id)).toBe(false);
    expect(await listPayments(B.id)).toEqual([]);
  });

  it("deleting a debt removes its payments", async () => {
    expect(await deleteDebt(A.id, loanId)).toBe(true);
    expect(await listPayments(A.id)).toEqual([]);
  });
});

describe("net worth", () => {
  let A: Awaited<ReturnType<typeof createTestUser>>;

  beforeAll(async () => {
    A = await createTestUser("nw-a");
    await insertAccount(A.id, account("Cash", "USD", 100_000));
    await insertAccount(A.id, account("Card", "USD", -30_000)); // owes on the card: a liability
    await insertAccount(A.id, { ...account("Hidden", "USD", 999_999), inNetWorth: false });
    await insertAccount(A.id, { ...account("Old", "USD", 888_888), isArchived: true });
    await insertDebt(A.id, { name: "Loan", direction: "owed_by_me", kind: "loan", currency: "USD", principal: 400_000, interestRate: 0, monthlyPayment: null, paymentDay: null, note: null });
    const friend = await insertDebt(A.id, { name: "Friend", direction: "owed_to_me", kind: "personal", currency: "USD", principal: 50_000, interestRate: 0, monthlyPayment: null, paymentDay: null, note: null });
    await insertPayment(A.id, friend, "2026-11-01", 20_000, null); // 300.00 still owed to me
  });

  afterAll(() => {
    delete process.env.FX_FIXED_RATES;
  });

  it("adds assets, subtracts liabilities; hidden, archived and paid-off items are left out", async () => {
    const r = await loadNetWorth(A.id, "USD");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // assets: cash 1 000 + friend 300 = 1 300; liabilities: card 300 + loan 4 000 = 4 300
    expect(r.netWorth).toMatchObject({ assets: 130_000, liabilities: 430_000, netWorth: -300_000 });
    expect(r.netWorth.items.map((i) => i.name).sort()).toEqual(["Card", "Cash", "Friend", "Loan"]);
  });

  it("converts other currencies at the day's rates", async () => {
    process.env.FX_FIXED_RATES = JSON.stringify({ USD: 1, EUR: 0.5 });
    await insertAccount(A.id, account("Euro", "EUR", 100_000)); // €1 000 = $2 000 at 0.5 EUR per USD
    const r = await loadNetWorth(A.id, "USD");
    expect(r.ok && r.netWorth.assets).toBe(130_000 + 200_000);
    delete process.env.FX_FIXED_RATES;
  });

  it("says the rates are unavailable instead of guessing when they cannot be loaded", async () => {
    const original = globalThis.fetch;
    globalThis.fetch = (() => Promise.reject(new Error("offline"))) as typeof fetch;
    try {
      const r = await loadNetWorth(A.id, "RUB"); // every item is foreign, nothing cached for RUB
      expect(r).toEqual({ ok: false, reason: "ratesUnavailable" });
    } finally {
      globalThis.fetch = original;
    }
  });

  it("keeps one snapshot per day and lists them oldest first, per currency", async () => {
    await upsertSnapshot(A.id, "2026-11-20", "USD", { assets: 100, liabilities: 40, netWorth: 60 });
    await upsertSnapshot(A.id, "2026-11-21", "USD", { assets: 120, liabilities: 40, netWorth: 80 });
    await upsertSnapshot(A.id, "2026-11-21", "USD", { assets: 130, liabilities: 40, netWorth: 90 }); // same day: replaces
    await upsertSnapshot(A.id, "2026-11-21", "EUR", { assets: 1, liabilities: 0, netWorth: 1 }); // same day, other currency: replaces too
    expect(await listSnapshots(A.id, "USD")).toEqual([{ date: "2026-11-20", assets: 100, liabilities: 40, netWorth: 60 }]);
    expect(await listSnapshots(A.id, "EUR")).toHaveLength(1);
  });

  it("deleting the account removes accounts, debts and snapshots", async () => {
    await db.delete(users).where(eq(users.id, A.id));
    expect(await listAccounts(A.id)).toEqual([]);
    expect(await listDebts(A.id)).toEqual([]);
    expect(await listSnapshots(A.id, "USD")).toEqual([]);
  });
});

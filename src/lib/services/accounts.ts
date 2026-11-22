import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import type { AccountKind } from "@/lib/accounts";
import { accounts, transactions } from "@/lib/db/schema";

/**
 * Every function takes the signed-in user's id and puts it in the WHERE clause,
 * so one user can never read or change another user's accounts.
 */


export type AccountRow = {
  id: string;
  name: string;
  kind: AccountKind;
  currency: string;
  openingBalance: number;
  inNetWorth: boolean;
  isArchived: boolean;
  /** Net of the transactions linked to the account (income minus expenses), in the account's currency. */
  linked: number;
  /** Opening balance plus linked transactions: what is on the account now. */
  balance: number;
};

export type AccountValues = {
  name: string;
  kind: AccountKind;
  currency: string;
  openingBalance: number;
  inNetWorth: boolean;
  isArchived: boolean;
};

/** Hard limit per user, so the lists stay small. */
export const MAX_ACCOUNTS = 50;

/**
 * Accounts with their balances. The balance is worked out here, not stored, so it always matches the transactions:
 * only transactions typed in the account's own currency count (the form makes sure they are).
 */
export async function listAccounts(userId: string): Promise<AccountRow[]> {
  const linked = sql<number>`coalesce(sum(case when ${transactions.type} = 'income' then ${transactions.originalAmount} else -${transactions.originalAmount} end), 0)`.mapWith(Number);
  const rows = await db
    .select({
      id: accounts.id,
      name: accounts.name,
      kind: accounts.kind,
      currency: accounts.currency,
      openingBalance: accounts.openingBalance,
      inNetWorth: accounts.inNetWorth,
      isArchived: accounts.isArchived,
      linked,
    })
    .from(accounts)
    .leftJoin(
      transactions,
      and(
        eq(transactions.accountId, accounts.id),
        eq(transactions.userId, accounts.userId),
        eq(transactions.originalCurrency, accounts.currency),
      ),
    )
    .where(eq(accounts.userId, userId))
    .groupBy(accounts.id)
    .orderBy(asc(accounts.isArchived), asc(accounts.createdAt));
  return rows.map((r) => ({ ...r, balance: r.openingBalance + r.linked }));
}

/** An account as the transaction form needs it: no balance, so it is cheap to load on every page. */
export type AccountOption = { id: string; name: string; kind: AccountKind; currency: string; isArchived: boolean };

export async function listAccountOptions(userId: string): Promise<AccountOption[]> {
  return db
    .select({ id: accounts.id, name: accounts.name, kind: accounts.kind, currency: accounts.currency, isArchived: accounts.isArchived })
    .from(accounts)
    .where(eq(accounts.userId, userId))
    .orderBy(asc(accounts.isArchived), asc(accounts.createdAt));
}

/** One account of this user, without its balance (or null). */
export async function findAccount(userId: string, id: string): Promise<AccountOption | null> {
  const [row] = await db
    .select({ id: accounts.id, name: accounts.name, kind: accounts.kind, currency: accounts.currency, isArchived: accounts.isArchived })
    .from(accounts)
    .where(and(eq(accounts.id, id), eq(accounts.userId, userId)));
  return row ?? null;
}

export async function getAccount(userId: string, id: string): Promise<AccountRow | null> {
  return (await listAccounts(userId)).find((a) => a.id === id) ?? null;
}

export async function insertAccount(userId: string, v: AccountValues): Promise<string> {
  const [row] = await db.insert(accounts).values({ ...v, userId }).returning({ id: accounts.id });
  return row.id;
}

/** The currency is not changed here: the linked transactions were typed in it. */
export async function updateAccount(userId: string, id: string, v: Omit<AccountValues, "currency">): Promise<boolean> {
  const res = await db.update(accounts).set(v).where(and(eq(accounts.id, id), eq(accounts.userId, userId)));
  return res.rowsAffected > 0;
}

export async function setOpeningBalance(userId: string, id: string, openingBalance: number): Promise<boolean> {
  const res = await db
    .update(accounts)
    .set({ openingBalance })
    .where(and(eq(accounts.id, id), eq(accounts.userId, userId)));
  return res.rowsAffected > 0;
}

/** Removes the account. Its transactions stay, just no longer linked to anything. */
export async function deleteAccount(userId: string, id: string): Promise<boolean> {
  const [, res] = await db.batch([
    db.update(transactions).set({ accountId: null }).where(and(eq(transactions.accountId, id), eq(transactions.userId, userId))),
    db.delete(accounts).where(and(eq(accounts.id, id), eq(accounts.userId, userId))),
  ]);
  return res.rowsAffected > 0;
}

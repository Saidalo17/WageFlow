"use server";

import { listTransactions } from "@/lib/services/transactions";
import { getCurrentUser } from "@/lib/session";

export type SearchHit = {
  id: string;
  type: "income" | "expense";
  amount: number;
  currency: string;
  occurredOn: string;
  note: string | null;
  categoryName: string;
  categorySystemKey: string | null;
};

/**
 * Transactions matching a text (note or category name) for the command center. Only the signed-in user's own
 * transactions can be found, and at most a handful come back: the full list lives on the transactions page.
 */
export async function searchTransactionsForCommand(query: unknown): Promise<SearchHit[]> {
  const user = await getCurrentUser();
  if (typeof query !== "string") return [];
  const q = query.trim().slice(0, 80);
  if (q.length < 2) return [];

  const { items } = await listTransactions(user.id, { q }, 6);
  return items.map((i) => ({
    id: i.id,
    type: i.type,
    amount: i.amount,
    currency: user.currency,
    occurredOn: i.occurredOn,
    note: i.note,
    categoryName: i.categoryName,
    categorySystemKey: i.categorySystemKey,
  }));
}

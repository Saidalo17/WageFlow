"use server";

import { revalidatePath } from "next/cache";
import { isForeignKeyViolation } from "@/lib/db/errors";
import { buildLearning, suggest } from "@/lib/import/categorize";
import { minorDigits } from "@/lib/money";
import { findAccount } from "@/lib/services/accounts";
import { listCategories } from "@/lib/services/categories";
import { existingBetween, insertImported, loadLearningHistory } from "@/lib/services/import";
import { getCurrentUser } from "@/lib/session";
import { analyzeSchema, commitSchema } from "@/lib/validators/import";
import { MAX_AMOUNT_MAJOR } from "@/lib/validators/transaction";

export type AnalyzedRow = {
  /** Suggested category (an id of one of the user's own, active categories). */
  categoryId: string;
  source: "history" | "keywords" | "default";
  /** The same date, direction and amount already exist (and were not matched by an earlier row of the file). */
  duplicate: boolean;
};

export type AnalyzeResult = { ok: true; items: AnalyzedRow[] } | { ok: false; error: string };
export type CommitResult = { ok: true; count: number } | { ok: false; error: string };

/**
 * For rows read from a statement: a suggested category for each (the user's own habits first, then a word list),
 * and which rows look like ones that are already in the app.
 */
export async function analyzeImport(input: unknown): Promise<AnalyzeResult> {
  const user = await getCurrentUser();
  const parsed = analyzeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
  const rows = parsed.data;

  const limit = MAX_AMOUNT_MAJOR * 10 ** minorDigits(user.currency);
  if (rows.some((r) => Math.abs(r.amount) > limit)) return { ok: false, error: "amountTooLarge" };

  const [categories, history] = await Promise.all([listCategories(user.id), loadLearningHistory(user.id)]);
  const active = categories.filter((c) => !c.isArchived);
  const byId = new Map(active.map((c) => [c.id, c]));
  const bySystemKey = new Map(active.map((c) => [`${c.type}|${c.systemKey}`, c.id]));
  const firstOfType = (type: "income" | "expense") => active.find((c) => c.type === type)?.id;
  const learning = buildLearning(history);

  const dates = rows.map((r) => r.date).sort();
  const existing = await existingBetween(user.id, dates[0], dates[dates.length - 1]);
  const seen = new Map<string, number>();
  for (const e of existing) {
    const key = `${e.occurredOn}|${e.type}|${e.amount}`;
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }

  const items: AnalyzedRow[] = [];
  for (const r of rows) {
    const type = r.amount > 0 ? "income" : "expense";
    const s = suggest(r.description, type, learning);

    // The user's own category is used only while it is still there, active and of the right kind.
    let categoryId: string | undefined;
    let source = s.source;
    if (s.categoryId && byId.get(s.categoryId)?.type === type) categoryId = s.categoryId;
    if (!categoryId) {
      categoryId = bySystemKey.get(`${type}|${s.systemKey}`) ?? bySystemKey.get(`${type}|${type === "income" ? "other_income" : "other_expense"}`);
      if (source === "history") source = "default";
    }
    categoryId ??= firstOfType(type);
    if (!categoryId) return { ok: false, error: "noCategories" };

    const key = `${r.date}|${type}|${Math.abs(r.amount)}`;
    const left = seen.get(key) ?? 0;
    if (left > 0) seen.set(key, left - 1);
    items.push({ categoryId, source, duplicate: left > 0 });
  }
  return { ok: true, items };
}

/** Saves the rows the user confirmed. Every category is checked to be the user's own, active and of the right kind. */
export async function commitImport(input: unknown): Promise<CommitResult> {
  const user = await getCurrentUser();
  const parsed = commitSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
  const rows = parsed.data;

  const limit = MAX_AMOUNT_MAJOR * 10 ** minorDigits(user.currency);
  if (rows.some((r) => r.amount > limit)) return { ok: false, error: "amountTooLarge" };

  const byId = new Map((await listCategories(user.id)).map((c) => [c.id, c]));
  for (const r of rows) {
    const c = byId.get(r.categoryId);
    if (!c || c.isArchived || c.type !== r.type) return { ok: false, error: "categoryRequired" };
  }

  // An account must be the user's own, active, and in the currency the file is taken to be in.
  for (const accountId of new Set(rows.map((r) => r.accountId).filter(Boolean) as string[])) {
    const account = await findAccount(user.id, accountId);
    if (!account || account.isArchived || account.currency !== user.currency) return { ok: false, error: "accountInvalid" };
  }

  try {
    const count = await insertImported(user.id, user.currency, rows);
    revalidatePath("/", "layout");
    return { ok: true, count };
  } catch (e) {
    if (isForeignKeyViolation(e)) return { ok: false, error: "categoryRequired" };
    console.error("commitImport failed", e instanceof Error ? e.message : e);
    return { ok: false, error: "generic" };
  }
}

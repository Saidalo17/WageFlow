"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { isForeignKeyViolation, isUniqueViolation } from "@/lib/db/errors";
import { requireUser } from "@/lib/session";
import {
  countCategoryTransactions,
  deleteCategoryRow,
  getCategory,
  insertCategory,
  setCategoryArchived,
  updateCategoryRow,
} from "@/lib/services/categories";
import { categoryIdSchema, categorySchema } from "@/lib/validators/category";

export type ActionResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };


function fieldErrorsOf(issues: { path: PropertyKey[]; message: string }[]) {
  const out: Record<string, string> = {};
  for (const i of issues) out[String(i.path[0] ?? "form")] ??= i.message;
  return out;
}

export async function createCategory(input: unknown): Promise<ActionResult> {
  const { id: userId } = await requireUser();
  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "invalid", fieldErrors: fieldErrorsOf(parsed.error.issues) };
  }
  try {
    await insertCategory(userId, parsed.data);
  } catch (e) {
    if (isUniqueViolation(e)) return { ok: false, error: "nameTaken", fieldErrors: { name: "nameTaken" } };
    console.error("createCategory failed", e instanceof Error ? e.message : e);
    return { ok: false, error: "generic" };
  }
  revalidatePath("/categories");
  return { ok: true };
}

export async function updateCategory(id: unknown, input: unknown): Promise<ActionResult> {
  const { id: userId } = await requireUser();
  const idParsed = categoryIdSchema.safeParse(id);
  const parsed = categorySchema.safeParse(input);
  if (!idParsed.success) return { ok: false, error: "generic" };
  if (!parsed.success) {
    return { ok: false, error: "invalid", fieldErrors: fieldErrorsOf(parsed.error.issues) };
  }

  const existing = await getCategory(userId, idParsed.data);
  if (!existing) return { ok: false, error: "notFound" };

  // The type of a category cannot change: its transactions would no longer match it.
  const values: { name?: string; color: string; icon: string; systemKey?: string | null } = {
    color: parsed.data.color,
    icon: parsed.data.icon,
  };

  if (existing.systemKey) {
    // A standard category shows a translated name. If the user left that name as it was,
    // it stays standard (and keeps translating). If they typed another one, it becomes custom.
    const t = await getTranslations("categories.system");
    if (parsed.data.name !== t(existing.systemKey)) {
      values.name = parsed.data.name;
      values.systemKey = null;
    }
  } else {
    values.name = parsed.data.name;
  }

  try {
    await updateCategoryRow(userId, existing.id, values);
  } catch (e) {
    if (isUniqueViolation(e)) return { ok: false, error: "nameTaken", fieldErrors: { name: "nameTaken" } };
    console.error("updateCategory failed", e instanceof Error ? e.message : e);
    return { ok: false, error: "generic" };
  }
  revalidatePath("/categories");
  return { ok: true };
}

export async function archiveCategory(id: unknown, archived: unknown): Promise<ActionResult> {
  const { id: userId } = await requireUser();
  const idParsed = categoryIdSchema.safeParse(id);
  if (!idParsed.success || typeof archived !== "boolean") return { ok: false, error: "generic" };
  const done = await setCategoryArchived(userId, idParsed.data, archived);
  if (!done) return { ok: false, error: "notFound" };
  revalidatePath("/categories");
  return { ok: true };
}

/** Deletes a category only if it has no transactions; otherwise it must be archived instead. */
export async function deleteCategory(id: unknown): Promise<ActionResult> {
  const { id: userId } = await requireUser();
  const idParsed = categoryIdSchema.safeParse(id);
  if (!idParsed.success) return { ok: false, error: "generic" };

  const used = await countCategoryTransactions(userId, idParsed.data);
  if (used > 0) return { ok: false, error: "hasTransactions" };

  try {
    const done = await deleteCategoryRow(userId, idParsed.data);
    if (!done) return { ok: false, error: "notFound" };
  } catch (e) {
    // Foreign key: a transaction appeared between the check and the delete.
    if (isForeignKeyViolation(e)) {
      return { ok: false, error: "hasTransactions" };
    }
    console.error("deleteCategory failed", e instanceof Error ? e.message : e);
    return { ok: false, error: "generic" };
  }
  revalidatePath("/categories");
  return { ok: true };
}

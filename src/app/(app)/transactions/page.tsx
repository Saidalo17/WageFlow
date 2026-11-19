import { getTranslations } from "next-intl/server";
import { TransactionsView } from "@/components/transactions/transactions-view";
import { getUserCategories } from "@/lib/data";
import { DEFAULT_CATEGORIES } from "@/lib/default-categories";
import { isRange, rangeBounds } from "@/lib/period";
import { listTransactions, sumTransactions, type TxFilters } from "@/lib/services/transactions";
import { getCurrentUser } from "@/lib/session";

const PAGE_SIZE = 30;
const MAX_LIMIT = 500;

export async function generateMetadata() {
  const t = await getTranslations("transactions");
  return { title: t("title") };
}

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function TransactionsPage({ searchParams }: PageProps<"/transactions">) {
  const user = await getCurrentUser();
  const sp = await searchParams;

  const rawRange = first(sp.range);
  const range = isRange(rawRange) ? rawRange : "month";
  const rawType = first(sp.type);
  const type = rawType === "income" || rawType === "expense" ? rawType : "all";
  const categoryId = (first(sp.category) ?? "").slice(0, 64);
  const q = (first(sp.q) ?? "").trim().slice(0, 100);
  const limit = Math.min(Math.max(Number(first(sp.limit)) || PAGE_SIZE, PAGE_SIZE), MAX_LIMIT);

  // Standard categories are stored in English but shown translated, so the search must match the shown name too.
  const tSys = await getTranslations("categories.system");
  const needle = q.toLowerCase();
  const systemKeys = q
    ? DEFAULT_CATEGORIES.map((c) => c.systemKey).filter((k) => tSys(k).toLowerCase().includes(needle))
    : [];

  const filters: TxFilters = {
    type: type === "all" ? undefined : type,
    categoryId: categoryId || undefined,
    ...rangeBounds(range, user.monthStartDay),
    q: q || undefined,
    systemKeys,
  };

  const [categories, list, totals] = await Promise.all([
    getUserCategories(user.id),
    listTransactions(user.id, filters, limit),
    sumTransactions(user.id, filters),
  ]);

  return (
    <TransactionsView
      items={list.items}
      hasMore={list.hasMore}
      limit={limit}
      totals={totals}
      currency={user.currency}
      categories={categories}
      filters={{ range, type, categoryId, q }}
    />
  );
}
import { getTranslations } from "next-intl/server";
import { CategoriesView } from "@/components/categories/categories-view";
import { currentPeriod } from "@/lib/period";
import { listCategoriesWithTotals } from "@/lib/services/categories";
import { getCurrentUser } from "@/lib/session";

export async function generateMetadata() {
  const t = await getTranslations("categories");
  return { title: t("title") };
}

export default async function CategoriesPage() {
  const user = await getCurrentUser();
  const categories = await listCategoriesWithTotals(user.id, currentPeriod(user.monthStartDay));
  return <CategoriesView categories={categories} currency={user.currency} />;
}
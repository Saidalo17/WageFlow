import { getTranslations } from "next-intl/server";
import { CategoriesView } from "@/components/categories/categories-view";
import { convertTotalsBy } from "@/lib/display-convert";
import { getDisplay } from "@/lib/display-currency";
import { currentPeriod } from "@/lib/period";
import { listCategoriesWithTotals } from "@/lib/services/categories";
import { getCurrentUser } from "@/lib/session";

export async function generateMetadata() {
  const t = await getTranslations("categories");
  return { title: t("title") };
}

export default async function CategoriesPage() {
  const user = await getCurrentUser();
  const display = await getDisplay(user.currency);
  const categories = convertTotalsBy(display, await listCategoriesWithTotals(user.id, currentPeriod(user.monthStartDay)));
  return <CategoriesView categories={categories} currency={display.currency} />;
}
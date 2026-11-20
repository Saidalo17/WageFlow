import { getLocale, getTranslations } from "next-intl/server";
import { BudgetsView } from "@/components/budgets/budgets-view";
import { getUserCategories } from "@/lib/data";
import { convertBudgets } from "@/lib/display-convert";
import { getDisplay } from "@/lib/display-currency";
import { formatDate } from "@/lib/format";
import { currentPeriod } from "@/lib/period";
import { listBudgets } from "@/lib/services/budgets";
import { getCurrentUser } from "@/lib/session";

export async function generateMetadata() {
  const t = await getTranslations("budgets");
  return { title: t("title") };
}

export default async function BudgetsPage() {
  const user = await getCurrentUser();
  const locale = await getLocale();
  const period = currentPeriod(user.monthStartDay);

  const display = await getDisplay(user.currency);
  const [rawBudgets, categories] = await Promise.all([
    listBudgets(user.id, period),
    getUserCategories(user.id),
  ]);

  const budgets = convertBudgets(display, rawBudgets);

  // Only active expense categories without a limit can get a new one.
  const withLimit = new Set(budgets.map((b) => b.categoryId));
  const available = categories.filter((c) => c.type === "expense" && !c.isArchived && !withLimit.has(c.id));

  const periodLabel = `${formatDate(period.from, locale, { day: "numeric", month: "long" })} – ${formatDate(period.to, locale, { day: "numeric", month: "long", year: "numeric" })}`;

  return (
    <BudgetsView
      budgets={budgets}
      available={available}
      currency={display.currency}
      periodLabel={periodLabel}
    />
  );
}

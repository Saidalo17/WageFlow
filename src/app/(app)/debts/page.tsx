import { getTranslations } from "next-intl/server";
import { DebtsView } from "@/components/finance/debts-view";
import { FinanceTabs } from "@/components/finance/finance-tabs";
import { listDebts, listPayments } from "@/lib/services/debts";
import { getCurrentUser } from "@/lib/session";

export async function generateMetadata() {
  const t = await getTranslations("debts");
  return { title: t("title") };
}

export default async function DebtsPage() {
  const user = await getCurrentUser();
  const [debts, payments] = await Promise.all([listDebts(user.id), listPayments(user.id)]);
  return (
    <div className="space-y-6">
      <FinanceTabs />
      <DebtsView debts={debts} payments={payments} currency={user.currency} />
    </div>
  );
}

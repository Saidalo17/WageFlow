import { getTranslations } from "next-intl/server";
import { AccountsView } from "@/components/finance/accounts-view";
import { FinanceTabs } from "@/components/finance/finance-tabs";
import { listAccounts } from "@/lib/services/accounts";
import { getCurrentUser } from "@/lib/session";

export async function generateMetadata() {
  const t = await getTranslations("accounts");
  return { title: t("title") };
}

export default async function AccountsPage() {
  const user = await getCurrentUser();
  const accounts = await listAccounts(user.id);
  return (
    <div className="space-y-6">
      <FinanceTabs />
      <AccountsView accounts={accounts} currency={user.currency} />
    </div>
  );
}

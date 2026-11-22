import { getTranslations } from "next-intl/server";
import { ImportWizard } from "@/components/transactions/import-wizard";
import { getUserCategories } from "@/lib/data";
import { listAccountOptions } from "@/lib/services/accounts";
import { getCurrentUser } from "@/lib/session";

export async function generateMetadata() {
  const t = await getTranslations("import");
  return { title: t("title") };
}

export default async function ImportPage() {
  const user = await getCurrentUser();
  const [categories, accounts] = await Promise.all([getUserCategories(user.id), listAccountOptions(user.id)]);
  // Only accounts in the main currency: the file is taken to be in it.
  const usable = accounts.filter((a) => !a.isArchived && a.currency === user.currency);
  return <ImportWizard categories={categories} accounts={usable} currency={user.currency} />;
}

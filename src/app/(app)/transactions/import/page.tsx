import { getTranslations } from "next-intl/server";
import { ImportWizard } from "@/components/transactions/import-wizard";
import { getUserCategories } from "@/lib/data";
import { getCurrentUser } from "@/lib/session";

export async function generateMetadata() {
  const t = await getTranslations("import");
  return { title: t("title") };
}

export default async function ImportPage() {
  const user = await getCurrentUser();
  const categories = await getUserCategories(user.id);
  return <ImportWizard categories={categories} currency={user.currency} />;
}

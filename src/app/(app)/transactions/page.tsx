import { getTranslations } from "next-intl/server";
import { PagePlaceholder } from "@/components/page-placeholder";

export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("transactions") };
}

export default async function TransactionsPage() {
  const t = await getTranslations("nav");
  return <PagePlaceholder title={t("transactions")} />;
}
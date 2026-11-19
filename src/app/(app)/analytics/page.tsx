import { getTranslations } from "next-intl/server";
import { PagePlaceholder } from "@/components/page-placeholder";

export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("analytics") };
}

export default async function AnalyticsPage() {
  const t = await getTranslations("nav");
  return <PagePlaceholder title={t("analytics")} />;
}
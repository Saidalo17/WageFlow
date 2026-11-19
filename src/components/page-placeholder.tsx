import { getTranslations } from "next-intl/server";

export async function PagePlaceholder({ title }: { title: string }) {
  const t = await getTranslations("common");
  return (
    <div className="space-y-6">
      <h1 className="text-[28px] font-extrabold tracking-tight">{title}</h1>
      <div className="rounded-2xl border bg-card p-7 text-muted-foreground shadow-[var(--shadow-card)]">
        {t("comingSoon")}
      </div>
    </div>
  );
}
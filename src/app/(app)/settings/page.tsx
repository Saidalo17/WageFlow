import { getTranslations } from "next-intl/server";
import { Card } from "@/components/card";
import { CountryForm } from "@/components/settings/country-form";
import { DeleteAccount } from "@/components/settings/delete-account";
import { ExportSection } from "@/components/settings/export-section";
import { PasswordForm } from "@/components/settings/password-form";
import { ProfileCard } from "@/components/settings/profile-card";
import { ProfileForm } from "@/components/settings/profile-form";
import { getCurrentUser } from "@/lib/session";
import { isLocale } from "@/i18n/config";

export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("settings") };
}

export default async function SettingsPage() {
  const user = await getCurrentUser();
  const t = await getTranslations("settings");

  return (
    <div className="space-y-6">
      <h1 className="text-[28px] font-extrabold tracking-tight">{t("title")}</h1>

      <Card title={t("profileCard.title")} index={1}>
        <ProfileCard
          initial={{
            name: user.name ?? "",
            bio: user.bio ?? "",
            emoji: user.emoji ?? "",
            accent: user.accent ?? "",
            avatarVersion: user.avatarUpdatedAt,
          }}
        />
      </Card>

      <Card title={t("sections.profile")} index={2}>
        <ProfileForm
          initial={{
            name: user.name ?? "",
            email: user.email,
            currency: user.currency,
            locale: isLocale(user.locale) ? user.locale : "en",
            monthStartDay: user.monthStartDay,
          }}
        />
      </Card>

      <Card title={t("sections.country")} index={3}>
        <CountryForm initial={user.country ?? ""} currency={user.currency} />
      </Card>

      <Card title={t("sections.security")} index={3}>
        <PasswordForm />
      </Card>

      <Card title={t("sections.data")} index={4}>
        <ExportSection />
      </Card>

      <Card title={t("sections.danger")} className="border-expense/40" index={5}>
        <DeleteAccount />
      </Card>
    </div>
  );
}

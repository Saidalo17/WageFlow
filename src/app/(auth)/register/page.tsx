import { getTranslations } from "next-intl/server";
import { RegisterForm } from "@/components/auth/register-form";

export async function generateMetadata() {
  const t = await getTranslations("auth.register");
  return { title: t("title") };
}

export default async function RegisterPage() {
  const t = await getTranslations("auth.register");
  return (
    <>
      <div className="mb-6 space-y-1.5">
        <h1 className="text-[28px] font-extrabold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>
      <RegisterForm />
    </>
  );
}
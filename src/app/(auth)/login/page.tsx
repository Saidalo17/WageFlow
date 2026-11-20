import { getTranslations } from "next-intl/server";
import { LoginForm } from "@/components/auth/login-form";

export async function generateMetadata() {
  const t = await getTranslations("auth.login");
  return { title: t("title") };
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const t = await getTranslations("auth");
  const sp = await searchParams;
  const justReset = sp.reset === "1";
  return (
    <>
      <div className="mb-6 space-y-1.5">
        <h1 className="text-[28px] font-extrabold tracking-tight">{t("login.title")}</h1>
        <p className="text-muted-foreground">{t("login.subtitle")}</p>
      </div>
      {justReset && (
        <p role="status" className="mb-5 rounded-xl bg-income-bg px-4 py-3 text-sm font-medium text-income">
          {t("reset.success")}
        </p>
      )}
      <LoginForm />
    </>
  );
}

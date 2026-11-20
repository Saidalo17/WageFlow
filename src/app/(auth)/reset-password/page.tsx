import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ResetForm } from "@/components/auth/reset-form";
import { buttonVariants } from "@/components/ui/button";
import { isResetTokenValid } from "@/lib/services/password-reset";

export async function generateMetadata() {
  const t = await getTranslations("auth.reset");
  return { title: t("title") };
}

export default async function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
  const t = await getTranslations("auth.reset");
  const sp = await searchParams;
  const token = Array.isArray(sp.token) ? sp.token[0] : sp.token;
  const valid = token ? await isResetTokenValid(token) : false;

  return (
    <>
      <div className="mb-6 space-y-1.5">
        <h1 className="text-[28px] font-extrabold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{valid ? t("subtitle") : t("invalid")}</p>
      </div>
      {valid && token ? (
        <ResetForm token={token} />
      ) : (
        <Link href="/forgot-password" className={buttonVariants({ size: "lg", className: "w-full" })}>
          {t("requestNew")}
        </Link>
      )}
    </>
  );
}

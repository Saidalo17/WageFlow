import { SearchX } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { buttonVariants } from "@/components/ui/button";

export async function generateMetadata() {
  const t = await getTranslations("notFound");
  return { title: t("title") };
}

export default async function NotFound() {
  const t = await getTranslations("notFound");
  return (
    <main className="mx-auto grid min-h-screen max-w-md place-items-center content-center gap-4 px-4 text-center">
      <span className="grid size-16 place-items-center rounded-full bg-accent text-accent-foreground">
        <SearchX className="size-7" />
      </span>
      <div className="space-y-2">
        <h1 className="text-2xl font-extrabold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("text")}</p>
      </div>
      <Link href="/" className={buttonVariants()}>
        {t("button")}
      </Link>
    </main>
  );
}

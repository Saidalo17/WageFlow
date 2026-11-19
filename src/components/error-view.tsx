"use client";

import { RotateCcw, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button, buttonVariants } from "@/components/ui/button";

/** Friendly screen shown when a page fails. The technical details stay in the server log. */
export function ErrorView({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("errorPage");

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div role="alert" className="mx-auto grid max-w-md place-items-center gap-4 py-16 text-center">
      <span className="grid size-16 place-items-center rounded-full bg-expense-bg text-expense">
        <TriangleAlert className="size-7" />
      </span>
      <div className="space-y-2">
        <h1 className="text-2xl font-extrabold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("text")}</p>
        {error.digest && (
          <p className="amount text-xs text-muted-foreground">{t("code", { code: error.digest })}</p>
        )}
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button onClick={reset} className="gap-1.5">
          <RotateCcw className="size-4" />
          {t("retry")}
        </Button>
        <Link href="/" className={buttonVariants({ variant: "secondary" })}>
          {t("home")}
        </Link>
      </div>
    </div>
  );
}

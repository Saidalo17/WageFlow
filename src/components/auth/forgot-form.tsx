"use client";

import { Loader2, MailCheck } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { requestPasswordReset } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { forgotSchema } from "@/lib/validators/auth";
import { useHydrated } from "@/lib/use-hydrated";
import { Field } from "./field";

export function ForgotForm() {
  const t = useTranslations("auth");
  const hydrated = useHydrated();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = forgotSchema.safeParse({ email });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "email");
      return;
    }
    setSending(true);
    const result = await requestPasswordReset({ email });
    setSending(false);
    if (result.ok) setSent(true);
    else setError(result.fieldErrors?.email ?? result.error);
  }

  if (sent) {
    return (
      <div className="space-y-5">
        <div className="flex gap-3 rounded-2xl bg-income-bg p-4 text-sm font-medium text-income" role="status">
          <MailCheck className="mt-0.5 size-5 shrink-0" aria-hidden />
          <p>{t("forgot.sent")}</p>
        </div>
        <Link href="/login" className="block text-center text-sm font-semibold text-link hover:underline">
          {t("forgot.back")}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <Field id="email" label={t("fields.email")} error={error ? t(`errors.${error}`) : undefined}>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={!!error}
          aria-describedby={error ? "email-error" : undefined}
        />
      </Field>
      <Button type="submit" size="lg" className="w-full" disabled={sending || !hydrated}>
        {sending && <Loader2 className="size-4 animate-spin" />}
        {t("forgot.submit")}
      </Button>
      <p className="text-center text-sm">
        <Link href="/login" className="font-semibold text-link hover:underline">
          {t("forgot.back")}
        </Link>
      </p>
    </form>
  );
}

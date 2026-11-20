"use client";

import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { resetPassword } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { useHydrated } from "@/lib/use-hydrated";
import { Field } from "./field";
import { PasswordInput } from "./password-input";

export function ResetForm({ token }: { token: string }) {
  const t = useTranslations("auth");
  const router = useRouter();
  const hydrated = useHydrated();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const msg = (key?: string) => (key ? t(`errors.${key}`) : undefined);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const local: Record<string, string> = {};
    if (password.length < 8) local.password = "passwordShort";
    else if (password.length > 72) local.password = "passwordLong";
    if (confirm !== password) local.confirm = "mismatch";
    setErrors(local);
    if (Object.keys(local).length > 0) return;

    setSaving(true);
    const result = await resetPassword({ token, password });
    setSaving(false);
    if (result.ok) {
      router.replace("/login?reset=1");
    } else if (result.fieldErrors && Object.keys(result.fieldErrors).length > 0) {
      setErrors(result.fieldErrors);
    } else {
      setFormError(result.error);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <Field id="password" label={t("reset.password")} hint={t("fields.passwordHint")} error={msg(errors.password)}>
        <PasswordInput
          id="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-invalid={!!errors.password}
          aria-describedby={errors.password ? "password-error" : undefined}
        />
      </Field>
      <Field id="confirm" label={t("reset.confirm")} error={msg(errors.confirm)}>
        <PasswordInput
          id="confirm"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          aria-invalid={!!errors.confirm}
          aria-describedby={errors.confirm ? "confirm-error" : undefined}
        />
      </Field>

      {formError && (
        <p role="alert" className="rounded-xl bg-expense-bg px-4 py-3 text-sm font-medium text-expense">
          {msg(formError)}{" "}
          {formError === "resetInvalid" && (
            <Link href="/forgot-password" className="font-semibold underline">
              {t("reset.requestNew")}
            </Link>
          )}
        </p>
      )}

      <Button type="submit" size="lg" className="w-full" disabled={saving || !hydrated}>
        {saving && <Loader2 className="size-4 animate-spin" />}
        {t("reset.submit")}
      </Button>
    </form>
  );
}

"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { changePassword } from "@/app/(app)/settings/actions";
import { Field } from "@/components/auth/field";
import { PasswordInput } from "@/components/auth/password-input";
import { Button } from "@/components/ui/button";

export function PasswordForm() {
  const t = useTranslations("settings");
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const msg = (key?: string) => (key ? t(`errors.${key}`) : undefined);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    const local: Record<string, string> = {};
    if (!current) local.current = "required";
    if (next.length < 8) local.next = "passwordShort";
    else if (next.length > 72) local.next = "passwordLong";
    if (confirm !== next) local.confirm = "mismatch";
    setErrors(local);
    if (Object.keys(local).length > 0) return;

    setSaving(true);
    const result = await changePassword({ current, next });
    setSaving(false);
    if (result.ok) {
      toast.success(t("password.changed"));
      setCurrent("");
      setNext("");
      setConfirm("");
      setErrors({});
    } else if (result.fieldErrors && Object.keys(result.fieldErrors).length > 0) {
      setErrors(result.fieldErrors);
    } else {
      setFormError(result.error);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="max-w-md space-y-5">
      <Field id="pw-current" label={t("password.current")} error={msg(errors.current)}>
        <PasswordInput
          id="pw-current"
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          aria-invalid={!!errors.current}
        />
      </Field>
      <Field id="pw-next" label={t("password.new")} hint={t("password.hint")} error={msg(errors.next)}>
        <PasswordInput
          id="pw-next"
          autoComplete="new-password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          aria-invalid={!!errors.next}
        />
      </Field>
      <Field id="pw-confirm" label={t("password.confirm")} error={msg(errors.confirm)}>
        <PasswordInput
          id="pw-confirm"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          aria-invalid={!!errors.confirm}
        />
      </Field>

      {formError && (
        <p role="alert" className="rounded-xl bg-expense-bg px-4 py-3 text-sm font-medium text-expense">
          {msg(formError)}
        </p>
      )}

      <Button type="submit" disabled={saving}>
        {saving && <Loader2 className="size-4 animate-spin" />}
        {t("password.submit")}
      </Button>
    </form>
  );
}

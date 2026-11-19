"use client";

import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { deleteAccount } from "@/app/(app)/settings/actions";
import { Field } from "@/components/auth/field";
import { PasswordInput } from "@/components/auth/password-input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function DeleteAccount() {
  const t = useTranslations("settings");
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground">{t("danger.description")}</p>
      <Button variant="destructive" onClick={() => setOpen(true)} className="gap-1.5">
        <Trash2 className="size-4" />
        {t("danger.button")}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          {/* Mounted only while open, so the password field starts empty every time. */}
          {open && <ConfirmForm onCancel={() => setOpen(false)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ConfirmForm({ onCancel }: { onCancel: () => void }) {
  const t = useTranslations("settings");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!password) {
      setError("required");
      return;
    }
    setBusy(true);
    setError(null);
    // On success the server signs the user out and redirects to the sign-in page.
    const result = await deleteAccount({ password });
    setBusy(false);
    if (result && !result.ok) setError(result.fieldErrors?.password ?? result.error);
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <DialogHeader>
        <DialogTitle className="text-xl font-extrabold">{t("danger.dialogTitle")}</DialogTitle>
      </DialogHeader>
      <div className="flex gap-3 rounded-2xl bg-expense-bg p-4 text-sm text-foreground">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-expense" />
        <DialogDescription className="text-foreground">{t("danger.dialogBody")}</DialogDescription>
      </div>
      <Field id="del-password" label={t("danger.passwordLabel")} error={error ? t(`errors.${error}`) : undefined}>
        <PasswordInput
          id="del-password"
          autoComplete="current-password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-invalid={!!error}
        />
      </Field>
      <DialogFooter className="gap-2 sm:gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          {t("cancel")}
        </Button>
        <Button type="submit" variant="destructive" disabled={busy}>
          {busy && <Loader2 className="size-4 animate-spin" />}
          {t("danger.confirm")}
        </Button>
      </DialogFooter>
    </form>
  );
}

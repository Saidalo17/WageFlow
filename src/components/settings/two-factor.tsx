"use client";

import { Check, Copy, Loader2, ShieldCheck, ShieldOff } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { confirmTwoFactor, resumeTwoFactor, startTwoFactor, turnOffTwoFactor } from "@/app/(app)/settings/actions";
import { Field } from "@/components/auth/field";
import { PasswordInput } from "@/components/auth/password-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Stage = "idle" | "scan" | "codes" | "off";

/** Two-factor sign-in with an authenticator app: set up (QR code, first code, backup codes) and switch off. */
export function TwoFactor({ enabled, backupLeft }: { enabled: boolean; backupLeft: number }) {
  const t = useTranslations("settings.twoFactor");
  const tErr = useTranslations("settings.errors");
  const router = useRouter();

  const [stage, setStage] = useState<Stage>("idle");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [setup, setSetup] = useState<{ secret: string; qr: string } | null>(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [codes, setCodes] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const reset = () => {
    setStage("idle");
    setError(null);
    setFieldErrors({});
    setCode("");
    setPassword("");
    setSetup(null);
  };

  async function begin() {
    setBusy(true);
    setError(null);
    const r = await startTwoFactor();
    setBusy(false);
    if (r.ok) {
      setSetup({ secret: r.secret, qr: r.qr });
      setStage("scan");
    } else if (r.error === "alreadyEnabled") {
      router.refresh();
    } else {
      setError(r.error);
    }
  }

  async function confirm(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await confirmTwoFactor(code);
    setBusy(false);
    if (r.ok) {
      setCodes(r.codes);
      setStage("codes");
      setCode("");
      toast.success(t("enabledToast"));
    } else {
      setError(r.error);
    }
  }

  async function turnOff(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setFieldErrors({});
    const r = await turnOffTwoFactor({ password, code });
    setBusy(false);
    if (r.ok) {
      toast.success(t("disabledToast"));
      reset();
      router.refresh();
    } else if (r.fieldErrors && Object.keys(r.fieldErrors).length > 0) {
      setFieldErrors(r.fieldErrors);
    } else {
      setError(r.error);
    }
  }

  async function copyCodes() {
    try {
      await navigator.clipboard.writeText(codes.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked: the codes are on screen */
    }
  }

  const errorBox = error && (
    <p role="alert" className="rounded-xl bg-expense-bg px-4 py-3 text-sm font-medium text-expense">
      {tErr(error)}
    </p>
  );

  // ----- backup codes, shown once after switching on -----
  if (stage === "codes") {
    return (
      <div className="max-w-md space-y-4">
        <p className="flex items-center gap-2 font-bold text-income">
          <ShieldCheck className="size-5" />
          {t("enabledTitle")}
        </p>
        <div className="space-y-2">
          <p className="font-semibold">{t("backupTitle")}</p>
          <p className="text-sm text-muted-foreground">{t("backupHint")}</p>
          <ul className="amount grid grid-cols-2 gap-2 rounded-2xl border bg-muted/40 p-4 font-mono text-base font-bold tracking-wider" data-testid="backup-codes">
            {codes.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={copyCodes}>
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copied ? t("copied") : t("copy")}
          </Button>
          <Button
            type="button"
            onClick={() => {
              reset();
              setCodes([]);
              router.refresh();
            }}
          >
            {t("saved")}
          </Button>
        </div>
      </div>
    );
  }

  // ----- setup -----
  if (stage === "scan" && setup) {
    return (
      <form onSubmit={confirm} noValidate className="max-w-md space-y-5">
        <div className="space-y-2">
          <p className="font-semibold">{t("scanTitle")}</p>
          <p className="text-sm text-muted-foreground">{t("scanHint")}</p>
          <div className="flex flex-wrap items-center gap-4">
            <Image src={setup.qr} alt={t("qrAlt")} width={168} height={168} unoptimized className="size-42 rounded-2xl border bg-white p-1" />
            <div className="min-w-0 space-y-1">
              <p className="text-sm text-muted-foreground">{t("manualKey")}</p>
              <p className="font-mono text-sm font-bold tracking-wider break-all select-all" data-testid="totp-secret">
                {setup.secret}
              </p>
            </div>
          </div>
        </div>
        <Field id="tf-code" label={t("codeLabel")} hint={t("codeHint")}>
          <Input id="tf-code" inputMode="numeric" autoComplete="one-time-code" maxLength={7} value={code} onChange={(e) => setCode(e.target.value)} aria-invalid={error === "invalidCode"} />
        </Field>
        {errorBox}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={busy || code.replace(/\s/g, "").length < 6}>
            {busy && <Loader2 className="size-4 animate-spin" />}
            {t("confirm")}
          </Button>
          <Button type="button" variant="ghost" onClick={reset}>
            {t("cancel")}
          </Button>
        </div>
      </form>
    );
  }

  // ----- switching off -----
  if (stage === "off") {
    return (
      <form onSubmit={turnOff} noValidate className="max-w-md space-y-5">
        <p className="text-sm text-muted-foreground">{t("disableHint")}</p>
        <Field id="tf-pass" label={t("passwordLabel")} error={fieldErrors.password ? tErr(fieldErrors.password) : undefined}>
          <PasswordInput id="tf-pass" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Field id="tf-off-code" label={t("codeLabel")} hint={t("codeOrBackup")} error={fieldErrors.code ? tErr(fieldErrors.code) : undefined}>
          <Input id="tf-off-code" autoComplete="one-time-code" maxLength={12} value={code} onChange={(e) => setCode(e.target.value)} />
        </Field>
        {errorBox}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant="destructive" disabled={busy || !password || !code}>
            {busy && <Loader2 className="size-4 animate-spin" />}
            {t("disable")}
          </Button>
          <Button type="button" variant="ghost" onClick={reset}>
            {t("cancel")}
          </Button>
        </div>
      </form>
    );
  }

  // ----- the resting state -----
  return (
    <div className="max-w-md space-y-4">
      {enabled ? (
        <>
          <p className="flex items-center gap-2 font-bold text-income">
            <ShieldCheck className="size-5" />
            {t("enabledTitle")}
          </p>
          <p className="text-sm text-muted-foreground">{t("enabledHint", { count: backupLeft })}</p>
          <Button type="button" variant="secondary" onClick={() => setStage("off")}>
            <ShieldOff className="size-4" />
            {t("disable")}
          </Button>
        </>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">{t("intro")}</p>
          {errorBox}
          <Button
            type="button"
            onClick={async () => {
              // an unfinished setup keeps its secret, so the same QR code comes back after a reload
              const resumed = await resumeTwoFactor();
              if (resumed.ok) {
                setSetup({ secret: resumed.secret, qr: resumed.qr });
                setStage("scan");
              } else {
                await begin();
              }
            }}
            disabled={busy}
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
            {t("enable")}
          </Button>
        </>
      )}
    </div>
  );
}

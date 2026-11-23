"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { markActive } from "@/lib/session-guard";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { registerUser } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { registerSchema, type RegisterValues } from "@/lib/validators/auth";
import { useHydrated } from "@/lib/use-hydrated";
import { Field } from "./field";
import { PasswordInput } from "./password-input";

export function RegisterForm() {
  const t = useTranslations("auth");
  const router = useRouter();
  const hydrated = useHydrated();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", email: "", password: "" },
  });

  const msg = (key?: string) => (key ? t(`errors.${key}`) : undefined);

  async function onSubmit(values: RegisterValues) {
    setFormError(null);
    const result = await registerUser(values);
    if (result.ok) {
      markActive();
      router.replace("/");
      router.refresh();
      return;
    }
    // Show server-side field errors under the matching field.
    const fields = result.fieldErrors ?? {};
    let shown = false;
    for (const [name, message] of Object.entries(fields)) {
      if (name === "name" || name === "email" || name === "password") {
        setError(name, { message });
        shown = true;
      }
    }
    if (!shown) setFormError(result.error);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
      <Field id="name" label={t("fields.name")} error={msg(errors.name?.message)}>
        <Input
          id="name"
          autoComplete="name"
          aria-invalid={!!errors.name}
          aria-describedby={errors.name ? "name-error" : undefined}
          {...register("name")}
        />
      </Field>
      <Field id="email" label={t("fields.email")} error={msg(errors.email?.message)}>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          maxLength={254}
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? "email-error" : undefined}
          {...register("email")}
        />
      </Field>
      <Field
        id="password"
        label={t("fields.password")}
        hint={t("fields.passwordHint")}
        error={msg(errors.password?.message)}
      >
        <PasswordInput
          id="password"
          autoComplete="new-password"
          aria-invalid={!!errors.password}
          aria-describedby={errors.password ? "password-error" : undefined}
          {...register("password")}
        />
      </Field>

      {formError && (
        <p role="alert" className="rounded-xl bg-expense-bg px-4 py-3 text-sm font-medium text-expense">
          {msg(formError)}
        </p>
      )}

      <Button type="submit" size="lg" className="w-full" disabled={isSubmitting || !hydrated}>
        {isSubmitting && <Loader2 className="size-4 animate-spin" />}
        {t("register.submit")}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        {t("register.haveAccount")}{" "}
        <Link href="/login" className="font-semibold text-link hover:underline">
          {t("register.toLogin")}
        </Link>
      </p>
    </form>
  );
}

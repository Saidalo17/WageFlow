"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { loginUser } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { loginSchema, type LoginValues } from "@/lib/validators/auth";
import { useHydrated } from "@/lib/use-hydrated";
import { Field } from "./field";
import { PasswordInput } from "./password-input";

export function LoginForm() {
  const t = useTranslations("auth");
  const router = useRouter();
  const hydrated = useHydrated();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });

  const msg = (key?: string) => (key ? t(`errors.${key}`) : undefined);

  async function onSubmit(values: LoginValues) {
    setFormError(null);
    const result = await loginUser(values);
    if (result.ok) {
      router.replace("/");
      router.refresh();
    } else {
      setFormError(result.error);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
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
      <Field id="password" label={t("fields.password")} error={msg(errors.password?.message)}>
        <PasswordInput
          id="password"
          autoComplete="current-password"
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
        {t("login.submit")}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        {t("login.noAccount")}{" "}
        <Link href="/register" className="font-semibold text-link hover:underline">
          {t("login.toRegister")}
        </Link>
      </p>
    </form>
  );
}

import { getTranslations } from "next-intl/server";
import Image from "next/image";
import { LanguageSwitcher } from "@/components/nav/language-switcher";
import { ThemeToggle } from "@/components/nav/theme-toggle";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("a11y");
  return (
    <div className="relative flex min-h-screen flex-col bg-gradient-to-br from-emerald/10 via-background to-gold/10">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:rounded-xl focus:bg-primary focus:px-4 focus:py-2.5 focus:text-sm focus:font-bold focus:text-primary-foreground focus:shadow-lg"
      >
        {t("skip")}
      </a>
      <div className="flex items-center justify-between px-4 py-4 sm:px-6">
        <div className="flex items-center gap-2 text-lg font-extrabold tracking-tight">
          <Image src="/logo.png" alt="" width={36} height={36} className="size-9 rounded-xl object-cover" />
          WageFlow
        </div>
        <div className="flex items-center gap-1">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
      </div>
      <main id="main" tabIndex={-1} className="flex flex-1 items-center justify-center px-4 pb-12 outline-none">
        <div className="reveal w-full max-w-md rounded-3xl border bg-card p-6 shadow-[var(--shadow-card)] sm:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}

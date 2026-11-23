import { getTranslations } from "next-intl/server";
import Image from "next/image";
import { LanguageSwitcher } from "@/components/nav/language-switcher";
import { ThemeToggle } from "@/components/nav/theme-toggle";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("a11y");
  return (
    <div className="relative isolate flex min-h-screen flex-col overflow-hidden bg-[#0b1220]">
      {/* The photo is the backdrop of the whole page, darkened so the form stays readable */}
      <Image src="/hero.png" alt="" fill priority sizes="100vw" className="-z-20 object-cover object-[30%_50%] opacity-60 blur-[1px]" />
      <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_70%_40%,rgba(11,18,32,0.35),rgba(11,18,32,0.92)_75%)]" />
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:rounded-xl focus:bg-primary focus:px-4 focus:py-2.5 focus:text-sm focus:font-bold focus:text-primary-foreground focus:shadow-lg"
      >
        {t("skip")}
      </a>
      <div className="flex items-center justify-between px-4 py-4 text-white sm:px-6">
        <div className="flex items-center gap-2 text-lg font-extrabold tracking-tight">
          <Image src="/logo.png" alt="" width={36} height={36} className="size-9 rounded-xl object-cover" />
          Kapio
        </div>
        <div className="dark flex items-center gap-1">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
      </div>
      <main id="main" tabIndex={-1} className="flex flex-1 items-center justify-center px-4 pb-12 outline-none">
        <div className="reveal w-full max-w-md rounded-3xl border bg-card/90 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}

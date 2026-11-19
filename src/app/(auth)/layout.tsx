import { Wallet } from "lucide-react";
import { LanguageSwitcher } from "@/components/nav/language-switcher";
import { ThemeToggle } from "@/components/nav/theme-toggle";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col bg-gradient-to-br from-brand-500/15 via-background to-violet-500/15">
      <div className="flex items-center justify-between px-4 py-4 sm:px-6">
        <div className="flex items-center gap-2 text-lg font-extrabold tracking-tight">
          <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-violet-500 text-white">
            <Wallet className="size-5" />
          </span>
          Salary
        </div>
        <div className="flex items-center gap-1">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
      </div>
      <main className="flex flex-1 items-center justify-center px-4 pb-12">
        <div className="w-full max-w-md rounded-3xl border bg-card p-6 shadow-[var(--shadow-card)] sm:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
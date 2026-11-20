import { getTranslations } from "next-intl/server";
import { TopNav } from "@/components/nav/top-nav";
import { TransactionModalProvider } from "@/components/transactions/transaction-modal-provider";
import { getUserCategories } from "@/lib/data";
import { getCurrentUser, requireUser } from "@/lib/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Second line of defence next to proxy.ts: no valid session -> /login.
  // requireUser() only reads the session cookie, so the profile and the categories
  // can then be loaded from the database at the same time instead of one after another.
  const { id } = await requireUser();
  const [user, categories, t] = await Promise.all([
    getCurrentUser(),
    getUserCategories(id),
    getTranslations("a11y"),
  ]);
  return (
    <TransactionModalProvider categories={categories} currency={user.currency}>
      {/* First Tab stop: lets keyboard users jump over the menu. Visible only while focused. */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:rounded-xl focus:bg-primary focus:px-4 focus:py-2.5 focus:text-sm focus:font-bold focus:text-primary-foreground focus:shadow-lg"
      >
        {t("skip")}
      </a>
      <TopNav
        user={{
          name: user.name,
          email: user.email,
          avatarVersion: user.avatarUpdatedAt,
          emoji: user.emoji,
          accent: user.accent,
        }}
      />
      <main
        id="main"
        tabIndex={-1}
        className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-6 outline-none sm:px-6 sm:py-8"
      >
        {children}
      </main>
    </TransactionModalProvider>
  );
}

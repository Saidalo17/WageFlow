import { getTranslations } from "next-intl/server";
import { DisplayNotice } from "@/components/nav/display-currency";
import { SessionGuard } from "@/components/auth/session-guard";
import { Sidebar } from "@/components/nav/sidebar";
import { TopNav } from "@/components/nav/top-nav";
import { PayReminders } from "@/components/salary/pay-reminders";
import { TransactionModalProvider } from "@/components/transactions/transaction-modal-provider";
import { getUserCategories } from "@/lib/data";
import { getDisplay } from "@/lib/display-currency";
import { listAccountOptions } from "@/lib/services/accounts";
import { listSchedules } from "@/lib/services/schedules";
import { getCurrentUser, requireUser } from "@/lib/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Second line of defence next to proxy.ts: no valid session -> /login.
  // requireUser() only reads the session cookie, so the profile and the categories
  // can then be loaded from the database at the same time instead of one after another.
  const { id } = await requireUser();
  const [user, categories, t, schedules, accounts] = await Promise.all([
    getCurrentUser(),
    getUserCategories(id),
    getTranslations("a11y"),
    listSchedules(id),
    listAccountOptions(id),
  ]);
  const display = await getDisplay(user.currency);
  return (
    <TransactionModalProvider categories={categories} accounts={accounts} currency={display.currency}>
      {/* First Tab stop: lets keyboard users jump over the menu. Visible only while focused. */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:rounded-xl focus:bg-primary focus:px-4 focus:py-2.5 focus:text-sm focus:font-bold focus:text-primary-foreground focus:shadow-lg"
      >
        {t("skip")}
      </a>
      <SessionGuard />
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopNav
            user={{
              name: user.name,
              email: user.email,
              avatarVersion: user.avatarUpdatedAt,
              emoji: user.emoji,
              accent: user.accent,
            }}
            displayCurrency={display.currency}
            categories={categories.map((c) => ({ id: c.id, name: c.name, systemKey: c.systemKey, type: c.type, isArchived: c.isArchived }))}
          />
          <DisplayNotice currency={display.currency} main={user.currency} failed={display.failed} />
          <PayReminders schedules={schedules} />
          <main
            id="main"
            tabIndex={-1}
            className="mx-auto w-full max-w-[1360px] flex-1 px-4 py-6 outline-none sm:px-6 sm:py-8"
          >
            {children}
          </main>
        </div>
      </div>
    </TransactionModalProvider>
  );
}

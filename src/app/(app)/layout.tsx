import { TopNav } from "@/components/nav/top-nav";
import { TransactionModalProvider } from "@/components/transactions/transaction-modal-provider";
import { getUserCategories } from "@/lib/data";
import { getCurrentUser } from "@/lib/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Second line of defence next to proxy.ts: no valid session -> /login.
  const user = await getCurrentUser();
  const categories = await getUserCategories(user.id);
  return (
    <TransactionModalProvider categories={categories} currency={user.currency}>
      <TopNav user={{ name: user.name, email: user.email }} />
      <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </main>
    </TransactionModalProvider>
  );
}
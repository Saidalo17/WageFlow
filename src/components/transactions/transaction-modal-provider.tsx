"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ResponsiveModal } from "@/components/responsive-modal";
import { TransactionForm } from "./transaction-form";
import type { AccountChoice, CategoryOption, TxItem } from "./types";

type ModalApi = {
  /** Opens the "new transaction" form from anywhere in the app. */
  openAdd: (type?: "income" | "expense", categoryId?: string) => void;
  openEdit: (item: TxItem) => void;
};

const Ctx = createContext<ModalApi | null>(null);

export function useTransactionModal() {
  const api = useContext(Ctx);
  if (!api) throw new Error("useTransactionModal must be used inside TransactionModalProvider");
  return api;
}

export function TransactionModalProvider({
  categories,
  accounts,
  currency,
  children,
}: {
  categories: CategoryOption[];
  accounts: AccountChoice[];
  currency: string;
  children: React.ReactNode;
}) {
  const t = useTranslations("transactions");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TxItem | null>(null);
  const [initialType, setInitialType] = useState<"income" | "expense">("expense");
  const [initialCategoryId, setInitialCategoryId] = useState<string | undefined>(undefined);
  // A new key on every opening gives the form fresh state.
  const [nonce, setNonce] = useState(0);

  const openAdd = useCallback((type: "income" | "expense" = "expense", categoryId?: string) => {
    setEditing(null);
    setInitialType(type);
    setInitialCategoryId(categoryId);
    setNonce((n) => n + 1);
    setOpen(true);
  }, []);
  const openEdit = useCallback((item: TxItem) => {
    setEditing(item);
    setNonce((n) => n + 1);
    setOpen(true);
  }, []);

  const api = useMemo(() => ({ openAdd, openEdit }), [openAdd, openEdit]);

  return (
    <Ctx.Provider value={api}>
      {children}
      <ResponsiveModal
        open={open}
        onOpenChange={setOpen}
        title={t(editing ? "form.editTitle" : "form.newTitle")}
      >
        <TransactionForm
          key={nonce}
          transaction={editing}
          initialType={initialType}
          initialCategoryId={initialCategoryId}
          categories={categories}
          accounts={accounts}
          currency={currency}
          onDone={() => setOpen(false)}
        />
      </ResponsiveModal>
    </Ctx.Provider>
  );
}

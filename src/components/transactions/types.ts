export type TxItem = {
  id: string;
  type: "income" | "expense";
  /** Minor units of the user's currency. */
  amount: number;
  /** What was typed: minor units of `originalCurrency` (null for very old rows). */
  originalAmount: number | null;
  originalCurrency: string | null;
  /** YYYY-MM-DD */
  occurredOn: string;
  note: string | null;
  categoryId: string;
  categoryName: string;
  categorySystemKey: string | null;
  categoryColor: string;
  categoryIcon: string;
};

export type CategoryOption = {
  id: string;
  name: string;
  type: "income" | "expense";
  color: string;
  icon: string;
  isArchived: boolean;
  systemKey: string | null;
};

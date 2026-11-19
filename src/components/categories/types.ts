export type CategoryItem = {
  id: string;
  name: string;
  type: "income" | "expense";
  color: string;
  icon: string;
  isArchived: boolean;
  systemKey: string | null;
  /** Sum of this period's transactions, in minor units. */
  total: number;
};

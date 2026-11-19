/**
 * Standard categories created for every new user. The `systemKey` lets the UI
 * show a translated name; `name` is the English fallback stored in the database.
 */
export type DefaultCategory = {
  systemKey: string;
  type: "income" | "expense";
  name: string;
  color: string;
  icon: string; // lucide icon name
};

export const DEFAULT_CATEGORIES: DefaultCategory[] = [
  { systemKey: "food", type: "expense", name: "Food", color: "#F59E0B", icon: "utensils" },
  { systemKey: "transport", type: "expense", name: "Transport", color: "#06B6D4", icon: "bus" },
  { systemKey: "housing", type: "expense", name: "Housing", color: "#6366F1", icon: "home" },
  { systemKey: "health", type: "expense", name: "Health", color: "#10B981", icon: "heart-pulse" },
  { systemKey: "entertainment", type: "expense", name: "Entertainment", color: "#EC4899", icon: "clapperboard" },
  { systemKey: "shopping", type: "expense", name: "Shopping", color: "#8B5CF6", icon: "shopping-bag" },
  { systemKey: "subscriptions", type: "expense", name: "Subscriptions", color: "#F97316", icon: "repeat" },
  { systemKey: "other_expense", type: "expense", name: "Other", color: "#64748B", icon: "circle-ellipsis" },
  { systemKey: "salary", type: "income", name: "Salary", color: "#10B981", icon: "briefcase" },
  { systemKey: "side_income", type: "income", name: "Side income", color: "#84CC16", icon: "laptop" },
  { systemKey: "gifts", type: "income", name: "Gifts", color: "#EC4899", icon: "gift" },
  { systemKey: "other_income", type: "income", name: "Other", color: "#64748B", icon: "circle-ellipsis" },
];

/** Reasonable starting currency for each interface language. */
export const DEFAULT_CURRENCY_BY_LOCALE: Record<string, string> = {
  en: "USD",
  de: "EUR",
  fr: "EUR",
  es: "EUR",
  ru: "RUB",
  zh: "CNY",
};

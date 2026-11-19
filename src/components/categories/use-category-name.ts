"use client";

import { useTranslations } from "next-intl";

/** Standard categories show a translated name; custom ones show what the user typed. */
export function useCategoryName() {
  const t = useTranslations("categories.system");
  return (c: { name: string; systemKey: string | null }) =>
    c.systemKey ? t(c.systemKey) : c.name;
}

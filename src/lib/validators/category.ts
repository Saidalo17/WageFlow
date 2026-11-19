import { z } from "zod";
import { CATEGORY_COLORS, CATEGORY_ICON_KEYS } from "@/lib/category-meta";

/** Error messages are translation keys (categories.errors.<key>). */
export const categorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { error: "required" })
    .max(40, { error: "nameLong" }),
  type: z.enum(["income", "expense"]),
  color: z.enum(CATEGORY_COLORS, { error: "generic" }),
  icon: z.enum(CATEGORY_ICON_KEYS, { error: "generic" }),
});

export type CategoryValues = z.infer<typeof categorySchema>;

export const categoryIdSchema = z.string().min(1).max(64);

import { cache } from "react";
import { listCategories } from "@/lib/services/categories";

/** The user's categories, loaded once per request even if the layout and the page both ask. */
export const getUserCategories = cache((userId: string) => listCategories(userId));

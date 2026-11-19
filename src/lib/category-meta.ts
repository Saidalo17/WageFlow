/** Allowed colors and icons for categories (no React here, so server and client can share it). */

export const CATEGORY_COLORS = [
  "#6366F1",
  "#8B5CF6",
  "#EC4899",
  "#F59E0B",
  "#10B981",
  "#06B6D4",
  "#F97316",
  "#84CC16",
  "#64748B",
  "#EF4444",
] as const;

export const CATEGORY_ICON_KEYS = [
  "utensils",
  "coffee",
  "shopping-bag",
  "shirt",
  "home",
  "zap",
  "wifi",
  "smartphone",
  "bus",
  "car",
  "fuel",
  "plane",
  "heart-pulse",
  "dumbbell",
  "graduation-cap",
  "book",
  "clapperboard",
  "gamepad",
  "music",
  "gift",
  "baby",
  "paw-print",
  "wrench",
  "repeat",
  "briefcase",
  "laptop",
  "banknote",
  "piggy-bank",
  "trending-up",
  "landmark",
  "gem",
  "circle-ellipsis",
] as const;

export type CategoryColor = (typeof CATEGORY_COLORS)[number];
export type CategoryIconKey = (typeof CATEGORY_ICON_KEYS)[number];

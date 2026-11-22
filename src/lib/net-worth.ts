/**
 * Net worth: everything owned (accounts with money, money owed to you) minus everything owed.
 * Items are in their own currencies; a `convert` function brings them into one currency.
 * Pure functions; money in minor units.
 */

export type WorthItem = {
  kind: "account" | "debt";
  id: string;
  name: string;
  currency: string;
  /** Signed, in the item's own currency: positive adds to the net worth, negative takes away. */
  amount: number;
};

export type ConvertedItem = WorthItem & {
  /** Signed, in the target currency. */
  converted: number;
};

export type NetWorth = {
  currency: string;
  /** Everything positive, in the target currency. */
  assets: number;
  /** Everything negative, as a positive number. */
  liabilities: number;
  netWorth: number;
  items: ConvertedItem[];
};

/**
 * `convert(minor, from)` turns minor units of `from` into minor units of the target currency
 * (it may throw when a rate is missing; nothing is hidden in that case).
 */
export function computeNetWorth(
  items: WorthItem[],
  currency: string,
  convert: (minor: number, from: string) => number,
): NetWorth {
  let assets = 0;
  let liabilities = 0;
  const converted: ConvertedItem[] = items.map((item) => {
    const value = item.currency === currency ? item.amount : convert(item.amount, item.currency);
    if (value >= 0) assets += value;
    else liabilities += -value;
    return { ...item, converted: value };
  });
  return { currency, assets, liabilities, netWorth: assets - liabilities, items: converted };
}

/** Accounts first (biggest first), then debts: the order the breakdown is shown in. */
export function sortItems<T extends { kind: "account" | "debt"; converted: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => (a.kind === b.kind ? Math.abs(b.converted) - Math.abs(a.converted) : a.kind === "account" ? -1 : 1));
}

/** Change between the first and the last point, or null with fewer than two points. */
export function trend(points: { netWorth: number }[]): { change: number; percent: number | null } | null {
  if (points.length < 2) return null;
  const first = points[0].netWorth;
  const last = points[points.length - 1].netWorth;
  return { change: last - first, percent: first !== 0 ? (last - first) / Math.abs(first) : null };
}

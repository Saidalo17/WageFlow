import { minorDigits } from "@/lib/money";

/**
 * Exchange rates. One free, key-less source that covers almost every ISO 4217 currency
 * (daily table, all values per 1 US dollar), with a second mirror as a fallback.
 * Only currency codes and a date are ever sent, never any user data.
 *
 * For tests and offline demos, set FX_FIXED_RATES='{"USD":1,"EUR":0.5}' (values per 1 USD).
 */

export class RatesUnavailableError extends Error {
  constructor(message = "Exchange rates are unavailable") {
    super(message);
    this.name = "RatesUnavailableError";
  }
}

/** Currency code (lower case) -> units of that currency per 1 USD. */
type Table = Record<string, number>;

const TIMEOUT_MS = 6000;
const latestCache: { at: number; table: Table } = { at: 0, table: {} };
const datedCache = new Map<string, Table>();
const LATEST_TTL_MS = 6 * 60 * 60 * 1000;

function sources(version: string) {
  return [
    `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${version}/v1/currencies/usd.json`,
    `https://${version}.currency-api.pages.dev/v1/currencies/usd.json`,
  ];
}

function parseTable(json: unknown): Table | null {
  const usd = (json as { usd?: Record<string, unknown> } | null)?.usd;
  if (!usd || typeof usd !== "object") return null;
  const table: Table = {};
  for (const [code, value] of Object.entries(usd)) {
    if (typeof value === "number" && Number.isFinite(value) && value > 0) table[code.toLowerCase()] = value;
  }
  table.usd = 1;
  return Object.keys(table).length > 20 ? table : null;
}

async function fetchTable(version: string): Promise<Table | null> {
  for (const url of sources(version)) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
      if (!res.ok) continue;
      const table = parseTable(await res.json());
      if (table) return table;
    } catch {
      /* try the next source */
    }
  }
  return null;
}

function fixedTable(): Table | null {
  const raw = process.env.FX_FIXED_RATES;
  if (!raw) return null;
  try {
    const table: Table = {};
    for (const [code, v] of Object.entries(JSON.parse(raw) as Record<string, number>)) {
      table[code.toLowerCase()] = Number(v);
    }
    table.usd = 1;
    return table;
  } catch {
    return null;
  }
}

/** Today's table (cached for a few hours). Throws RatesUnavailableError when no source answers. */
export async function getLatestTable(): Promise<Table> {
  const fixed = fixedTable();
  if (fixed) return fixed;
  if (Date.now() - latestCache.at < LATEST_TTL_MS && Object.keys(latestCache.table).length > 0) {
    return latestCache.table;
  }
  const table = await fetchTable("latest");
  if (table) {
    latestCache.at = Date.now();
    latestCache.table = table;
    return table;
  }
  // A slightly old table is better than none.
  if (Object.keys(latestCache.table).length > 0) return latestCache.table;
  throw new RatesUnavailableError();
}

/** The table of a past day; falls back to today's table when that day is not available. */
async function getTableFor(date: string | undefined): Promise<Table> {
  const today = new Date().toISOString().slice(0, 10);
  if (!date || date >= today || fixedTable()) return getLatestTable();
  const cached = datedCache.get(date);
  if (cached) return cached;
  const table = await fetchTable(date);
  if (table) {
    if (datedCache.size > 200) datedCache.clear();
    datedCache.set(date, table);
    return table;
  }
  return getLatestTable();
}

/** Units of `to` for 1 unit of `from`. */
export function rateFromTable(table: Table, from: string, to: string): number {
  const a = table[from.toLowerCase()];
  const b = table[to.toLowerCase()];
  if (!a || !b) throw new RatesUnavailableError(`No rate for ${!a ? from : to}`);
  return b / a;
}

/** Rate on a given day (YYYY-MM-DD); with no date, today's rate. */
export async function getRate(from: string, to: string, date?: string): Promise<number> {
  if (from === to) return 1;
  return rateFromTable(await getTableFor(date), from, to);
}

/**
 * Converts an amount in minor units. Different currencies have different decimals
 * (JPY 0, USD 2, KWD 3), so the result is rescaled. Never returns less than 1 for a positive input.
 */
export function convertMinor(minor: number, from: string, to: string, rate: number): number {
  if (from === to) return minor;
  const scaled = minor * rate * 10 ** (minorDigits(to) - minorDigits(from));
  return Math.max(1, Math.round(scaled));
}

/** Multiplier to turn minor units of `from` into minor units of `to` (used in SQL). */
export function minorMultiplier(from: string, to: string, rate: number): number {
  return rate * 10 ** (minorDigits(to) - minorDigits(from));
}

/**
 * Turning the cells of a statement into transactions: which column is which, dates and amounts in the many
 * formats banks use. Pure functions.
 */

import { parseAmount } from "@/lib/money";

export type DateOrder = "dmy" | "mdy" | "ymd";

/** Index of a column, or -1 when the statement has no such column. */
export type ColumnMapping = {
  date: number;
  description: number;
  /** One column with signed amounts (minus = spent). */
  amount: number;
  /** Or separate columns for money out and money in. */
  debit: number;
  credit: number;
};

export const NO_COLUMN = -1;

const HEADER_WORDS: Record<keyof ColumnMapping, string[]> = {
  date: ["date", "дата", "datum", "buchungstag", "fecha", "日付", "날짜", "tarih", "日期", "transaction date", "posted"],
  description: [
    "description", "details", "payee", "merchant", "memo", "narrative", "reference", "name",
    "назначение", "описание", "контрагент", "получатель", "детали", "операция",
    "verwendungszweck", "beschreibung", "buchungstext", "empfänger", "concepto", "descripción", "descripcion",
    "libellé", "libelle", "intitulé", "摘要", "説明", "内容", "내용", "açıklama", "aciklama", "detay",
  ],
  amount: ["amount", "сумма", "betrag", "importe", "montant", "金額", "金额", "금액", "tutar", "value"],
  debit: ["debit", "withdrawal", "money out", "paid out", "расход", "списание", "soll", "cargo", "débit", "出金", "支出", "출금", "borç"],
  credit: ["credit", "deposit", "money in", "paid in", "приход", "зачисление", "поступление", "haben", "abono", "crédit", "入金", "收入", "입금", "alacak"],
};

function matchRole(header: string): keyof ColumnMapping | null {
  const h = header.toLowerCase().trim();
  if (!h) return null;
  // debit/credit first: "debit amount" is a debit column, not the amount column
  for (const role of ["debit", "credit", "date", "amount", "description"] as const) {
    if (HEADER_WORDS[role].some((w) => h.includes(w))) return role;
  }
  return null;
}

// ---------- Dates ----------

/** A date written as 2026-11-05, 05.11.2026, 5/11/26 or 11/05/2026 (with an optional time) -> "YYYY-MM-DD", or null. */
export function parseDate(text: string, order: DateOrder): string | null {
  const m = text.trim().match(/^(\d{1,4})[.\-/\s](\d{1,2})[.\-/\s](\d{1,4})(?:[\sT,].*)?$/);
  if (!m) return null;
  const [a, b, c] = [Number(m[1]), Number(m[2]), Number(m[3])];
  let y: number, mo: number, d: number;
  if (m[1].length === 4) {
    [y, mo, d] = [a, b, c]; // year first is always year-month-day
  } else if (order === "mdy") {
    [mo, d, y] = [a, b, c];
  } else {
    [d, mo, y] = [a, b, c];
  }
  if (y < 100) y += 2000;
  if (y < 1970 || y > 2100 || mo < 1 || mo > 12 || d < 1) return null;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Day-month-year or month-day-year, decided by dates that can only be read one way (like 25/12). */
export function guessDateOrder(samples: string[], fallback: DateOrder): DateOrder {
  let dmy = false;
  let mdy = false;
  for (const s of samples) {
    const m = s.trim().match(/^(\d{1,4})[.\-/\s](\d{1,2})[.\-/\s](\d{1,4})/);
    if (!m) continue;
    if (m[1].length === 4) return "ymd";
    if (Number(m[1]) > 12) dmy = true;
    if (Number(m[2]) > 12) mdy = true;
  }
  if (dmy && !mdy) return "dmy";
  if (mdy && !dmy) return "mdy";
  return fallback;
}

// ---------- Amounts ----------

/**
 * "1 250,50", "-3.99", "(45.00)", "12,30-", "$ 1,234.56", "−500 ₽" -> signed number, or null when it is not an amount.
 * `locale` decides how a lone "," or "." is read (decimal mark or thousands separator).
 */
export function parseAmountCell(text: string, locale: string): number | null {
  let s = text.trim();
  if (!s) return null;
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  if (/^[-−–—]/.test(s)) {
    negative = true;
    s = s.slice(1);
  }
  if (/[-−–—]\s*$/.test(s)) {
    negative = true;
    s = s.replace(/[-−–—]\s*$/, "");
  }
  // Drop currency symbols, codes and spaces; keep digits and the separators.
  s = s.replace(/[^\d.,\s'’]/g, "").trim();
  if (!/\d/.test(s)) return null;
  const n = parseAmount(s, locale);
  if (n === null) return null;
  return negative ? -n : n;
}

// ---------- Columns ----------

/** True when the first row looks like column names rather than a transaction. */
export function hasHeaderRow(rows: string[][]): boolean {
  const first = rows[0];
  if (!first) return false;
  const roles = new Set(first.map(matchRole).filter(Boolean));
  if (roles.size >= 2) return true;
  const looksLikeData = first.some((c) => parseDate(c, "dmy") !== null) || first.some((c) => /\d/.test(c) && parseAmountCell(c, "en") !== null);
  return !looksLikeData && roles.size >= 1;
}

const share = (cells: string[], test: (c: string) => boolean) => {
  const filled = cells.filter((c) => c !== "");
  return filled.length === 0 ? 0 : filled.filter(test).length / filled.length;
};

/** Best guess of which column is the date, the description and the amount(s). */
export function guessMapping(rows: string[][], header: boolean, locale: string): ColumnMapping {
  const mapping: ColumnMapping = { date: NO_COLUMN, description: NO_COLUMN, amount: NO_COLUMN, debit: NO_COLUMN, credit: NO_COLUMN };
  const width = Math.max(0, ...rows.slice(0, 20).map((r) => r.length));
  const data = rows.slice(header ? 1 : 0, (header ? 1 : 0) + 30);
  const column = (i: number) => data.map((r) => r[i] ?? "");

  if (header) {
    rows[0].forEach((h, i) => {
      const role = matchRole(h);
      if (role && mapping[role] === NO_COLUMN) mapping[role] = i;
    });
  }

  const used = () => new Set(Object.values(mapping).filter((v) => v !== NO_COLUMN));

  if (mapping.date === NO_COLUMN) {
    for (let i = 0; i < width; i++) {
      if (used().has(i)) continue;
      if (share(column(i), (c) => parseDate(c, "dmy") !== null || parseDate(c, "mdy") !== null) >= 0.8) {
        mapping.date = i;
        break;
      }
    }
  }
  if (mapping.amount === NO_COLUMN && mapping.debit === NO_COLUMN && mapping.credit === NO_COLUMN) {
    for (let i = 0; i < width; i++) {
      if (used().has(i)) continue;
      if (share(column(i), (c) => parseAmountCell(c, locale) !== null) >= 0.8) {
        mapping.amount = i;
        break;
      }
    }
  }
  if (mapping.description === NO_COLUMN) {
    let best = -1;
    let bestLen = 0;
    for (let i = 0; i < width; i++) {
      if (used().has(i)) continue;
      const cells = column(i).filter((c) => c !== "");
      if (cells.length === 0 || share(cells, (c) => parseAmountCell(c, locale) !== null) > 0.5) continue;
      const avg = cells.reduce((s, c) => s + c.length, 0) / cells.length;
      if (avg > bestLen) {
        best = i;
        bestLen = avg;
      }
    }
    mapping.description = best;
  }
  return mapping;
}

// ---------- Rows ----------

export type ParsedRow = {
  /** Line in the file (1-based), for messages. */
  line: number;
  date: string;
  description: string;
  /** Signed, in major units: positive = money in, negative = money out. */
  amount: number;
};

export type ParseResult = { rows: ParsedRow[]; skipped: number };

/** Cells -> transactions. Rows without a usable date or amount (totals, balances, notes) are counted as skipped. */
export function parseRows(
  rows: string[][],
  mapping: ColumnMapping,
  header: boolean,
  order: DateOrder,
  locale: string,
): ParseResult {
  const out: ParsedRow[] = [];
  let skipped = 0;
  const start = header ? 1 : 0;

  for (let i = start; i < rows.length; i++) {
    const r = rows[i];
    const date = mapping.date === NO_COLUMN ? null : parseDate(r[mapping.date] ?? "", order);

    let amount: number | null = null;
    if (mapping.amount !== NO_COLUMN) {
      amount = parseAmountCell(r[mapping.amount] ?? "", locale);
    } else {
      const debit = mapping.debit === NO_COLUMN ? null : parseAmountCell(r[mapping.debit] ?? "", locale);
      const credit = mapping.credit === NO_COLUMN ? null : parseAmountCell(r[mapping.credit] ?? "", locale);
      if (debit !== null && debit !== 0) amount = -Math.abs(debit);
      else if (credit !== null && credit !== 0) amount = Math.abs(credit);
    }

    if (!date || amount === null || amount === 0) {
      skipped++;
      continue;
    }
    out.push({
      line: i + 1,
      date,
      description: (mapping.description === NO_COLUMN ? "" : (r[mapping.description] ?? "")).replace(/\s+/g, " ").trim(),
      amount,
    });
  }
  return { rows: out, skipped };
}

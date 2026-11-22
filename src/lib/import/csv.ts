/**
 * Reading a bank statement exported as CSV: text encoding, the separator and the cells.
 * Runs in the browser, so the file itself never has to leave the computer before the user has seen what is in it.
 */

/**
 * Bytes to text. UTF-8 (with or without a BOM) and UTF-16 are recognized; anything else is read as Windows-1251,
 * the encoding many banks in Russia and neighbouring countries still use for statements.
 */
export function decodeBytes(bytes: Uint8Array): string {
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder("utf-16le").decode(bytes);
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder("utf-16be").decode(bytes);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/^﻿/, "");
  } catch {
    return new TextDecoder("windows-1251").decode(bytes);
  }
}

const DELIMITERS = [",", ";", "\t", "|"] as const;

/** The separator that splits the first lines into the same number of cells (outside quotes). */
export function detectDelimiter(text: string): string {
  const lines = text.split(/\r\n|\n|\r/).filter((l) => l.trim() !== "").slice(0, 8);
  let best = ",";
  let bestScore = 0;
  for (const d of DELIMITERS) {
    const counts = lines.map((l) => {
      let n = 0;
      let quoted = false;
      for (const ch of l) {
        if (ch === '"') quoted = !quoted;
        else if (ch === d && !quoted) n++;
      }
      return n;
    });
    const first = counts[0] ?? 0;
    if (first === 0) continue;
    // Every line should have as many separators as the first one; more of them is better.
    const consistent = counts.filter((c) => c === first).length;
    const score = consistent * 1000 + first;
    if (score > bestScore) {
      bestScore = score;
      best = d;
    }
  }
  return best;
}

/** Cells of every line. Handles quotes (including doubled quotes and line breaks inside them). Empty lines are skipped. */
export function parseCsv(text: string, delimiter = detectDelimiter(text)): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  const endCell = () => {
    row.push(cell.trim());
    cell = "";
  };
  const endRow = () => {
    endCell();
    if (row.some((c) => c !== "")) rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        cell += ch;
      }
    } else if (ch === '"' && cell === "") {
      quoted = true;
    } else if (ch === delimiter) {
      endCell();
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      endRow();
    } else {
      cell += ch;
    }
  }
  if (cell !== "" || row.length > 0) endRow();
  return rows;
}

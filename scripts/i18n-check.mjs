// Checks that all translation files have the same keys and placeholders as English.
// Run: npm run i18n:check   (exits with an error when something is missing or different)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DIR = path.join(here, "..", "src", "messages");
const MAIN = "en";

function flatten(obj, prefix = "") {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object") Object.assign(out, flatten(v, key));
    else out[key] = v;
  }
  return out;
}

const placeholders = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");

/** Returns a list of human-readable problems (empty when everything matches). */
export function checkMessages(dir = DEFAULT_DIR) {
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
  const locales = files.map((f) => f.replace(".json", ""));
  const problems = [];
  if (!locales.includes(MAIN)) return [`${MAIN}.json is missing`];

  const data = Object.fromEntries(
    locales.map((l) => [l, flatten(JSON.parse(fs.readFileSync(path.join(dir, `${l}.json`), "utf8")))]),
  );
  const base = data[MAIN];

  for (const [locale, messages] of Object.entries(data)) {
    for (const [key, value] of Object.entries(messages)) {
      if (typeof value !== "string" || value.trim() === "") problems.push(`${locale}: empty text for "${key}"`);
    }
    if (locale === MAIN) continue;
    for (const key of Object.keys(base)) {
      if (!(key in messages)) problems.push(`${locale}: missing key "${key}"`);
      else if (placeholders(base[key]) !== placeholders(messages[key])) {
        problems.push(`${locale}: placeholders of "${key}" differ from English ({${placeholders(base[key])}} vs {${placeholders(messages[key])}})`);
      }
    }
    for (const key of Object.keys(messages)) {
      if (!(key in base)) problems.push(`${locale}: extra key "${key}" not in English`);
    }
  }
  return problems;
}

export const LOCALES_CHECKED = () => fs.readdirSync(DEFAULT_DIR).filter((f) => f.endsWith(".json")).map((f) => f.replace(".json", ""));

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const problems = checkMessages();
  if (problems.length) {
    console.error(`i18n check failed (${problems.length} problems):`);
    for (const p of problems) console.error("  - " + p);
    process.exit(1);
  }
  console.log(`i18n check passed: ${LOCALES_CHECKED().join(", ")} have identical keys and placeholders.`);
}

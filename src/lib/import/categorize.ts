/**
 * Suggesting a category for an imported bank operation.
 *
 * Two sources, strongest first:
 *  1. What the user already did: a description seen before (same shop, same payee) gets the category the user
 *     chose for it most often. Every import teaches the next one.
 *  2. A word list for common shops and kinds of payments in the app's languages.
 * Anything else goes to "Other" of the right kind.
 */

export type Kind = "income" | "expense";

export type Suggestion = {
  /** systemKey of a standard category (food, transport, ...). */
  systemKey: string;
  source: "history" | "keywords" | "default";
  /** Set when the suggestion comes from the user's own history: the category id they used. */
  categoryId?: string;
};

/** Lower case, card numbers, dates and punctuation removed: "PYATEROCHKA 1234 *5678" -> "pyaterochka". */
export function normalizeDescription(text: string): string {
  return text
    .toLowerCase()
    .replace(/[0-9*#№]+/g, " ")
    .replace(/[^\p{L}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Words are matched inside the normalized text. Keep them specific: short words match too much.
const EXPENSE_WORDS: [string, string[]][] = [
  // Subscriptions come before entertainment and shopping: "Netflix" is a subscription.
  [
    "subscriptions",
    ["netflix", "spotify", "youtube premium", "apple com bill", "itunes", "icloud", "google one", "subscription", "подписка", "adobe", "microsoft 365", "patreon", "яндекс плюс", "yandex plus", "кинопоиск", "kinopoisk", "disney", "hbo", "prime video", "chatgpt", "openai", "abonnement", "suscripción", "suscripcion", "abo "],
  ],
  [
    "food",
    ["supermarket", "supermarkt", "grocery", "groceries", "market", "restaurant", "restaurante", "ресторан", "cafe", "café", "кафе", "coffee", "кофе", "pizza", "пицца", "burger", "mcdonald", "макдоналдс", "kfc", "starbucks", "subway", "uber eats", "delivery club", "доставка еды", "яндекс еда", "wolt", "glovo", "пятерочка", "пятёрочка", "pyaterochka", "pyatyorochka", "magnit", "perekrestok", "vkusvill", "вкусвилл", "dixy", "дикси", "магнит", "перекресток", "перекрёсток", "лента", "азбука вкуса", "ашан", "продукты", "магазин продуктов", "lidl", "aldi", "rewe", "edeka", "penny", "carrefour", "mercadona", "tesco", "monoprix", "auchan", "bakery", "булочная", "пекарня", "bäckerei", "panadería", "boulangerie", "food", "еда", "ресторан", "lokanta", "bim", "a101", "migros", "食", "スーパー", "コンビニ", "マート", "마트", "편의점", "餐", "超市"],
  ],
  [
    "transport",
    ["uber", "taxi", "такси", "yandex go", "яндекс go", "яндекс такси", "bolt", "metro", "метро", "subway ticket", "bus ", "автобус", "fuel", "gas station", "petrol", "tankstelle", "азс", "бензин", "shell", "lukoil", "лукойл", "газпромнефть", "train", "ржд", "railway", "bahn", "renfe", "sncf", "parking", "парковка", "tfl", "bvg", "ubahn", "suica", "pasmo", "교통", "택시", "地铁", "打车", "didi", "otopark", "istanbulkart", "аэрофлот", "airline", "flight", "ryanair", "lufthansa"],
  ],
  [
    "housing",
    ["rent", "аренда", "квартплата", "жкх", "коммунальн", "utilities", "electricity", "water bill", "gas bill", "internet", "интернет", "miete", "strom", "nebenkosten", "alquiler", "loyer", "家賃", "월세", "관리비", "kira", "房租", "水电", "mortgage", "ипотека", "hypothek", "hipoteca"],
  ],
  [
    "health",
    ["pharmacy", "аптека", "apotheke", "farmacia", "pharmacie", "clinic", "клиника", "hospital", "больница", "doctor", "врач", "dental", "стоматолог", "medical", "медицин", "arzt", "médecin", "病院", "薬局", "병원", "약국", "eczane", "hastane", "药店", "医院", "optic", "оптика"],
  ],
  [
    "entertainment",
    ["cinema", "кино", "theatre", "театр", "concert", "концерт", "steam", "playstation", "xbox", "nintendo", "museum", "музей", "bar ", "club", "клуб", "ticket", "билет", "bowling", "боулинг", "kino", "sinema", "映画", "영화", "电影", "ktv", "amusement", "парк"],
  ],
  [
    "shopping",
    ["amazon", "ozon", "озон", "wildberries", "вайлдберриз", "aliexpress", "алиэкспресс", "zara", "h m", "ikea", "икеа", "mall", "торговый центр", "dns ", "мвидео", "эльдорадо", "apple store", "uniqlo", "taobao", "淘宝", "京东", "jd com", "shein", "decathlon", "декатлон", "leroy merlin", "леруа", "obi", "mediamarkt", "fnac", "el corte", "zalando", "ebay", "trendyol", "hepsiburada", "楽天", "쿠팡", "coupang"],
  ],
];

const INCOME_WORDS: [string, string[]][] = [
  ["salary", ["salary", "зарплата", "заработная плата", "аванс", "gehalt", "lohn", "nómina", "nomina", "salaire", "paie", "給与", "급여", "maaş", "maas", "工资", "payroll", "wage", "оклад"]],
  ["gifts", ["gift", "подарок", "geschenk", "regalo", "cadeau", "プレゼント", "선물", "hediye", "礼"]],
  ["side_income", ["freelance", "фриланс", "invoice", "счет", "счёт за", "honorar", "consulting", "консультац", "upwork", "fiverr", "dividend", "дивиденд", "interest", "проценты", "cashback", "кэшбэк", "кешбэк", "возврат", "refund"]],
];

function matchWords(table: [string, string[]][], normalized: string): string | null {
  // A trailing space in a word (like "bus ") means "end of a word"; compare against text padded with a space.
  const padded = ` ${normalized} `;
  for (const [key, words] of table) {
    if (words.some((w) => (w.endsWith(" ") ? padded.includes(` ${w}`) : normalized.includes(w)))) return key;
  }
  return null;
}

/** Category kind of a keyword match, or null. */
export function keywordCategory(description: string, kind: Kind): string | null {
  const normalized = normalizeDescription(description);
  if (!normalized) return null;
  return matchWords(kind === "income" ? INCOME_WORDS : EXPENSE_WORDS, normalized);
}

export type HistoryEntry = { note: string | null; categoryId: string; type: Kind };

/** What the user's earlier operations say: normalized description -> the category used most often for it. */
export function buildLearning(history: HistoryEntry[]): Map<string, string> {
  const counts = new Map<string, Map<string, number>>();
  for (const h of history) {
    if (!h.note) continue;
    const key = `${h.type}|${normalizeDescription(h.note)}`;
    if (key.endsWith("|")) continue;
    const byCategory = counts.get(key) ?? new Map<string, number>();
    byCategory.set(h.categoryId, (byCategory.get(h.categoryId) ?? 0) + 1);
    counts.set(key, byCategory);
  }
  const best = new Map<string, string>();
  for (const [key, byCategory] of counts) {
    let top = "";
    let topCount = 0;
    for (const [categoryId, n] of byCategory) {
      if (n > topCount) {
        top = categoryId;
        topCount = n;
      }
    }
    best.set(key, top);
  }
  return best;
}

/** The user's own category for this description, when an equal (or clearly contained) one was seen before. */
export function learnedCategory(learning: Map<string, string>, description: string, kind: Kind): string | null {
  const normalized = normalizeDescription(description);
  if (!normalized) return null;
  const exact = learning.get(`${kind}|${normalized}`);
  if (exact) return exact;
  // "pyaterochka moskva" vs a remembered "pyaterochka": one contains the other (at least 6 letters, so tiny words never match).
  for (const [key, categoryId] of learning) {
    const [k, text] = [key.slice(0, key.indexOf("|")), key.slice(key.indexOf("|") + 1)];
    if (k !== kind || text.length < 6) continue;
    if (normalized.includes(text) || (normalized.length >= 6 && text.includes(normalized))) return categoryId;
  }
  return null;
}

/** The final suggestion for one operation. */
export function suggest(description: string, kind: Kind, learning: Map<string, string>): Suggestion {
  const own = learnedCategory(learning, description, kind);
  if (own) return { systemKey: "", source: "history", categoryId: own };
  const key = keywordCategory(description, kind);
  if (key) return { systemKey: key, source: "keywords" };
  return { systemKey: kind === "income" ? "other_income" : "other_expense", source: "default" };
}

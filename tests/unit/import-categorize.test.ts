import { describe, expect, it } from "vitest";
import { buildLearning, keywordCategory, learnedCategory, normalizeDescription, suggest } from "@/lib/import/categorize";

describe("normalizeDescription", () => {
  it("drops numbers, card masks and punctuation", () => {
    expect(normalizeDescription("PYATEROCHKA 1234 *5678, MOSKVA")).toBe("pyaterochka moskva");
    expect(normalizeDescription("  Café   Roma #12 ")).toBe("café roma");
    expect(normalizeDescription("123 456")).toBe("");
  });
});

describe("keywordCategory", () => {
  it.each([
    ["Netflix.com", "expense", "subscriptions"],
    ["PYATEROCHKA 1234", "expense", "food"],
    ["Пятёрочка", "expense", "food"],
    ["REWE Markt GmbH", "expense", "food"],
    ["Uber *Trip", "expense", "transport"],
    ["Яндекс Такси", "expense", "transport"],
    ["Аптека 36.6", "expense", "health"],
    ["Wildberries", "expense", "shopping"],
    ["Rent November", "expense", "housing"],
    ["Cinema Park", "expense", "entertainment"],
    ["Зарплата за октябрь", "income", "salary"],
    ["Gehalt 11/2026", "income", "salary"],
    ["Подарок от мамы", "income", "gifts"],
    ["Freelance invoice 44", "income", "side_income"],
  ] as const)("%s (%s) -> %s", (text, kind, expected) => {
    expect(keywordCategory(text, kind)).toBe(expected);
  });

  it("subscriptions win over shopping for the same text", () => {
    expect(keywordCategory("AMAZON PRIME VIDEO", "expense")).toBe("subscriptions");
  });

  it("says null for unknown or empty text", () => {
    expect(keywordCategory("Transfer to John", "expense")).toBeNull();
    expect(keywordCategory("", "expense")).toBeNull();
  });

  it("a word with a trailing space only matches whole words", () => {
    expect(keywordCategory("Bus 42", "expense")).toBe("transport");
    expect(keywordCategory("Busy bee", "expense")).toBeNull();
  });
});

describe("learning from the user's history", () => {
  const learning = buildLearning([
    { note: "Corner Shop 12", categoryId: "cat-food", type: "expense" },
    { note: "corner shop 99", categoryId: "cat-food", type: "expense" },
    { note: "corner shop", categoryId: "cat-shopping", type: "expense" },
    { note: "Maria Ivanova", categoryId: "cat-gifts", type: "income" },
    { note: null, categoryId: "cat-x", type: "expense" },
  ]);

  it("uses the category chosen most often for the same description", () => {
    expect(learnedCategory(learning, "CORNER SHOP 7", "expense")).toBe("cat-food");
  });
  it("matches when one description contains the other", () => {
    expect(learnedCategory(learning, "Corner Shop Berlin Mitte", "expense")).toBe("cat-food");
  });
  it("keeps income and expense apart", () => {
    expect(learnedCategory(learning, "Maria Ivanova", "income")).toBe("cat-gifts");
    expect(learnedCategory(learning, "Maria Ivanova", "expense")).toBeNull();
  });
  it("never matches on tiny words", () => {
    expect(learnedCategory(buildLearning([{ note: "ab", categoryId: "c", type: "expense" }]), "abcdefgh", "expense")).toBeNull();
  });
});

describe("suggest", () => {
  const learning = buildLearning([{ note: "Netflix.com", categoryId: "my-fun", type: "expense" }]);
  it("prefers the user's own choice over the word list", () => {
    expect(suggest("NETFLIX.COM 123", "expense", learning)).toEqual({ systemKey: "", source: "history", categoryId: "my-fun" });
  });
  it("falls back to words, then to Other", () => {
    expect(suggest("Spotify AB", "expense", learning)).toEqual({ systemKey: "subscriptions", source: "keywords" });
    expect(suggest("Unknown payee", "expense", learning)).toEqual({ systemKey: "other_expense", source: "default" });
    expect(suggest("Unknown payer", "income", learning)).toEqual({ systemKey: "other_income", source: "default" });
  });
});

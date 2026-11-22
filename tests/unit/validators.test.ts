import { describe, expect, it } from "vitest";
import { budgetStatus } from "@/lib/budget-status";
import { loginSchema, registerSchema } from "@/lib/validators/auth";
import { createBudgetSchema, updateBudgetSchema } from "@/lib/validators/budget";
import { categorySchema } from "@/lib/validators/category";
import { changePasswordSchema, deleteAccountSchema, profileSchema } from "@/lib/validators/settings";
import { transactionSchema } from "@/lib/validators/transaction";

const firstError = (r: { success: boolean; error?: { issues: { message: string }[] } }) =>
  r.success ? null : r.error!.issues[0].message;

describe("sign up and sign in", () => {
  it("accepts a normal account", () => {
    expect(registerSchema.safeParse({ name: "Anna", email: "anna@gmail.com", password: "Blue-sky-2026" }).success).toBe(true);
    expect(registerSchema.safeParse({ name: "", email: "a@b.co", password: "x1".repeat(36) }).success).toBe(true); // 72 bytes
  });

  it("explains what is wrong", () => {
    expect(firstError(registerSchema.safeParse({ name: "", email: "", password: "Blue-sky-2026" }))).toBe("required");
    expect(firstError(registerSchema.safeParse({ name: "", email: "not-an-email", password: "Blue-sky-2026" }))).toBe("email");
    expect(firstError(registerSchema.safeParse({ name: "", email: "a@b.co", password: "sh0rt" }))).toBe("passwordShort");
    expect(firstError(registerSchema.safeParse({ name: "", email: "a@b.co", password: "x1".repeat(37) }))).toBe("passwordLong");
    expect(firstError(registerSchema.safeParse({ name: "n".repeat(61), email: "a@b.co", password: "Blue-sky-2026" }))).toBe("nameLong");
  });

  it("login only needs something in both fields", () => {
    expect(loginSchema.safeParse({ email: "a@b.co", password: "x" }).success).toBe(true);
    expect(loginSchema.safeParse({ email: "a@b.co", password: "" }).success).toBe(false);
  });
});

describe("transactions", () => {
  const valid = { type: "expense", categoryId: "cat1", amount: 12345, occurredOn: "2026-11-10", note: "  lunch  " };

  it("accepts a valid transaction and cleans the note", () => {
    const r = transactionSchema.safeParse(valid);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.note).toBe("lunch");
  });

  it("turns an empty or missing note into null", () => {
    for (const note of ["", "   ", undefined, null]) {
      const r = transactionSchema.safeParse({ ...valid, note });
      expect(r.success).toBe(true);
      if (r.success) expect(r.data.note).toBeNull();
    }
  });

  it("rejects bad amounts", () => {
    expect(firstError(transactionSchema.safeParse({ ...valid, amount: 0 }))).toBe("amountRequired");
    expect(firstError(transactionSchema.safeParse({ ...valid, amount: -5 }))).toBe("amountRequired");
    expect(firstError(transactionSchema.safeParse({ ...valid, amount: 10.5 }))).toBe("amountInvalid");
    expect(firstError(transactionSchema.safeParse({ ...valid, amount: "100" }))).toBe("amountInvalid");
    expect(firstError(transactionSchema.safeParse({ ...valid, amount: Number.NaN }))).toBe("amountInvalid");
  });

  it("rejects bad dates", () => {
    for (const occurredOn of ["", "2026-02-30", "26-11-10", "yesterday", "2026-13-01"]) {
      expect(firstError(transactionSchema.safeParse({ ...valid, occurredOn })), occurredOn).toBe("dateInvalid");
    }
    expect(firstError(transactionSchema.safeParse({ ...valid, occurredOn: "2099-01-01" }))).toBe("dateInvalid"); // too far ahead
  });

  it("rejects a wrong type, a missing category and a long note", () => {
    expect(transactionSchema.safeParse({ ...valid, type: "transfer" }).success).toBe(false);
    expect(firstError(transactionSchema.safeParse({ ...valid, categoryId: "" }))).toBe("categoryRequired");
    expect(firstError(transactionSchema.safeParse({ ...valid, note: "x".repeat(201) }))).toBe("noteLong");
  });
});

describe("categories", () => {
  const valid = { name: "Coffee", type: "expense", color: "#EC4899", icon: "coffee" };
  it("accepts any hex color and known icons only", () => {
    expect(categorySchema.safeParse(valid).success).toBe(true);
    expect(categorySchema.safeParse({ ...valid, color: "#123456" }).success).toBe(true); // any color is allowed
    expect(categorySchema.parse({ ...valid, color: "#abcdef" }).color).toBe("#ABCDEF");
    for (const bad of ["red", "#12345", "#GGGGGG", "123456", "url(x)"]) {
      expect(categorySchema.safeParse({ ...valid, color: bad }).success, bad).toBe(false);
    }
    expect(categorySchema.safeParse({ ...valid, icon: "skull" }).success).toBe(false);
    expect(categorySchema.safeParse({ ...valid, type: "other" }).success).toBe(false);
  });
  it("checks the name", () => {
    expect(firstError(categorySchema.safeParse({ ...valid, name: "   " }))).toBe("required");
    expect(firstError(categorySchema.safeParse({ ...valid, name: "x".repeat(41) }))).toBe("nameLong");
    const r = categorySchema.safeParse({ ...valid, name: "  Tea  " });
    expect(r.success && r.data.name).toBe("Tea");
  });
});

describe("budgets", () => {
  it("needs a category and a positive whole limit", () => {
    expect(createBudgetSchema.safeParse({ categoryId: "c1", limit: 10000 }).success).toBe(true);
    expect(firstError(createBudgetSchema.safeParse({ categoryId: "", limit: 10000 }))).toBe("categoryRequired");
    expect(firstError(createBudgetSchema.safeParse({ categoryId: "c1", limit: 0 }))).toBe("amountRequired");
    expect(firstError(updateBudgetSchema.safeParse({ limit: 1.5 }))).toBe("amountInvalid");
  });

  it("status is calm under 80%, a warning up to 100%, and exceeded above", () => {
    expect(budgetStatus(0)).toBe("ok");
    expect(budgetStatus(0.79)).toBe("ok");
    expect(budgetStatus(0.8)).toBe("warning");
    expect(budgetStatus(1)).toBe("warning");
    expect(budgetStatus(1.0001)).toBe("over");
    expect(budgetStatus(2.5)).toBe("over");
  });
});

describe("settings", () => {
  const valid = { name: "Anna", currency: "EUR", locale: "de", monthStartDay: 15 };
  it("accepts any real currency and the nine languages", () => {
    expect(profileSchema.safeParse(valid).success).toBe(true);
    for (const locale of ["en", "de", "fr", "es", "ru", "zh", "ja", "ko", "tr"]) expect(profileSchema.safeParse({ ...valid, locale }).success).toBe(true);
    expect(profileSchema.safeParse({ ...valid, currency: "KWD" }).success).toBe(true);
  });
  it("rejects everything else", () => {
    expect(firstError(profileSchema.safeParse({ ...valid, currency: "BTC" }))).toBe("currencyInvalid");
    expect(profileSchema.safeParse({ ...valid, locale: "it" }).success).toBe(false);
    for (const monthStartDay of [0, 29, 1.5, "5"]) expect(profileSchema.safeParse({ ...valid, monthStartDay }).success, String(monthStartDay)).toBe(false);
  });
  it("password change and account deletion need real passwords", () => {
    expect(changePasswordSchema.safeParse({ current: "old", next: "Blue-sky-2026" }).success).toBe(true);
    expect(firstError(changePasswordSchema.safeParse({ current: "old", next: "sh0rt" }))).toBe("passwordShort");
    expect(firstError(changePasswordSchema.safeParse({ current: "", next: "Blue-sky-2026" }))).toBe("required");
    expect(firstError(changePasswordSchema.safeParse({ current: "old", next: "onlyletters" }))).toBe("passwordWeak");
    expect(deleteAccountSchema.safeParse({ password: "x" }).success).toBe(true);
    expect(deleteAccountSchema.safeParse({ password: "" }).success).toBe(false);
  });
});

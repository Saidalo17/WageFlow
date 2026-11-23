import { describe, expect, it } from "vitest";
import { checkEmailDomain, type Resolver } from "@/lib/email-check";
import {
  containsEmailName,
  isCommonPassword,
  isReservedDomain,
  isSensibleEmail,
  loginSchema,
  passwordSchema,
  registerSchema,
} from "@/lib/validators/auth";

const firstError = (r: { success: boolean; error?: { issues: { message: string }[] } }) =>
  r.success ? null : r.error!.issues[0].message;

describe("email must look like a real address", () => {
  it.each(["anna@gmail.com", "a.b+tag@gmail.com", "user_1@mail.ru", "x@icloud.com", "ivan@mail.ru"])(
    "accepts %s",
    (value) => {
      expect(loginSchema.safeParse({ email: value, password: "x1" }).success).toBe(true);
    },
  );

  it.each([
    "hello",
    "just some text",
    "a@b",
    "a@b.c",
    "a@@b.com",
    "@gmail.com",
    "anna@",
    "anna@-gmail.com",
    "anna@gmail-.com",
    "anna@gmail..com",
    "anna@gmail.c0m",
    "anna@gmail.123",
    "an na@gmail.com",
    ".anna@gmail.com",
    "anna.@gmail.com",
    `${"a".repeat(65)}@gmail.com`,
    `anna@${"a".repeat(64)}.com`,
    `anna@gmail.${"c".repeat(25)}`,
  ])("rejects %s", (value) => {
    expect(firstError(loginSchema.safeParse({ email: value, password: "x1" }))).toBe("email");
  });

  it("trims spaces around a good address", () => {
    expect(loginSchema.parse({ email: "  anna@gmail.com  ", password: "x1" }).email).toBe("anna@gmail.com");
  });

  it("isSensibleEmail looks at the parts", () => {
    expect(isSensibleEmail("a@b.co")).toBe(true);
    expect(isSensibleEmail("a@b")).toBe(false);
  });
});

describe("reserved domains", () => {
  it.each(["example.com", "mail.example.org", "me.test", "x.localhost", "corp.internal", "home.local", "foo.invalid"])("%s can not receive real mail", (d) => {
    expect(isReservedDomain(d)).toBe(true);
  });
  it.each(["gmail.com", "examples.com", "myexample.com", "mail.ru"])("%s is a normal domain", (d) => {
    expect(isReservedDomain(d)).toBe(false);
  });
});

describe("password rules (sign up, password change)", () => {
  it("accepts a reasonable password, also with other alphabets", () => {
    for (const p of ["Blue-sky-2026", "correct horse 7 battery", "Пароль-2026-ok", "密码密码密码密码9"]) {
      expect(passwordSchema.safeParse(p).success, p).toBe(true);
    }
  });

  it("explains what is wrong, shortest problem first", () => {
    expect(firstError(passwordSchema.safeParse("sh0rt"))).toBe("passwordShort");
    expect(firstError(passwordSchema.safeParse("onlyletters"))).toBe("passwordWeak");
    expect(firstError(passwordSchema.safeParse("1234567890123"))).toBe("passwordWeak");
    expect(firstError(passwordSchema.safeParse("        "))).toBe("passwordWeak");
    expect(firstError(passwordSchema.safeParse("Passw0rd"))).toBe("passwordCommon");
    expect(firstError(passwordSchema.safeParse("password123"))).toBe("passwordCommon");
    expect(firstError(passwordSchema.safeParse("a1".repeat(40)))).toBe("passwordLong");
    expect(firstError(passwordSchema.safeParse("abc\u0000def12"))).toBe("passwordChars");
  });

  it("counts the limit in bytes, because that is what the hashing function reads", () => {
    // 36 two-byte letters + digits = 72 bytes is fine, one more is not
    expect(passwordSchema.safeParse("я".repeat(35) + "12").success).toBe(true);
    expect(firstError(passwordSchema.safeParse("я".repeat(36) + "12"))).toBe("passwordLong");
  });

  it("rejects plain sequences and repeats, and the usual suspects", () => {
    for (const p of ["12345678", "87654321", "abcdefgh", "11111111", "qwerty123", "Password1", "1q2w3e4r"]) {
      expect(isCommonPassword(p), p).toBe(true);
    }
    expect(isCommonPassword("Blue-sky-2026")).toBe(false);
  });

  it("must not contain the name from the email", () => {
    expect(containsEmailName("anna.petrova-2026", "anna.petrova@gmail.com")).toBe(true);
    expect(containsEmailName("ANNA.PETROVA-2026", "anna.petrova@gmail.com")).toBe(true);
    expect(containsEmailName("Blue-sky-2026", "anna.petrova@gmail.com")).toBe(false);
    expect(containsEmailName("abc-2026-xyz", "abc@gmail.com")).toBe(false); // short names are ignored
    expect(firstError(registerSchema.safeParse({ name: "", email: "ivanov@gmail.com", password: "my-ivanov-2026" }))).toBe("passwordEmail");
  });
});

describe("sign-in only checks that the input is sane", () => {
  it("lets old, simple passwords through", () => {
    expect(loginSchema.safeParse({ email: "a@gmail.com", password: "abc12345" }).success).toBe(true);
  });
  it("refuses empty, control-character and oversized passwords", () => {
    expect(firstError(loginSchema.safeParse({ email: "a@gmail.com", password: "" }))).toBe("required");
    expect(firstError(loginSchema.safeParse({ email: "a@gmail.com", password: "a\nb" }))).toBe("passwordChars");
    expect(firstError(loginSchema.safeParse({ email: "a@gmail.com", password: "x1".repeat(37) }))).toBe("passwordLong");
  });
});

describe("checkEmailDomain", () => {
  const notFound = Object.assign(new Error("nx"), { code: "ENOTFOUND" });
  const resolver = (over: Partial<Resolver>): Resolver => ({
    mx: async () => [],
    addresses: async () => [],
    ...over,
  });

  it("refuses reserved domains without asking the network", async () => {
    const never: Resolver = { mx: () => Promise.reject(new Error("must not be called")), addresses: () => Promise.reject(new Error("must not be called")) };
    expect(await checkEmailDomain("a@example.com", never)).toBe("reserved");
    expect(await checkEmailDomain("a@me.test", never)).toBe("reserved");
  });

  it("accepts a domain with a mail server", async () => {
    expect(await checkEmailDomain("a@gmail.com", resolver({ mx: async () => [{ exchange: "mx.google.com" }] }))).toBe("ok");
  });

  it("accepts a domain with no MX but an address record (the standard fallback)", async () => {
    expect(await checkEmailDomain("a@small.org", resolver({ mx: async () => Promise.reject(notFound), addresses: async () => ["1.2.3.4"] }))).toBe("ok");
  });

  it("refuses a domain that does not exist", async () => {
    expect(await checkEmailDomain("a@nope-nope.com", resolver({ mx: async () => Promise.reject(notFound), addresses: async () => Promise.reject(notFound) }))).toBe("no-mail");
    expect(await checkEmailDomain("a@nope-nope.com", resolver({}))).toBe("no-mail");
  });

  it("refuses a domain that says it accepts no mail (null MX)", async () => {
    expect(await checkEmailDomain("a@nomail.org", resolver({ mx: async () => [{ exchange: "" }] }))).toBe("no-mail");
    expect(await checkEmailDomain("a@nomail.org", resolver({ mx: async () => [{ exchange: "." }] }))).toBe("no-mail");
  });

  it("never blocks anybody because of network trouble", async () => {
    const down = Object.assign(new Error("down"), { code: "ESERVFAIL" });
    expect(await checkEmailDomain("a@gmail.com", resolver({ mx: async () => Promise.reject(down) }))).toBe("ok");
    expect(await checkEmailDomain("a@gmail.com", resolver({ mx: async () => Promise.reject(notFound), addresses: async () => Promise.reject(down) }))).toBe("ok");
  });
});

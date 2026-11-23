import { beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import {
  backupCodesLeft,
  beginSetup,
  checkSecondFactor,
  confirmSetup,
  disableTwoFactor,
  isTwoFactorEnabled,
  pendingSecret,
} from "@/lib/services/two-factor";
import { codeAtStep, stepAt } from "@/lib/totp";
import { eq } from "drizzle-orm";
import { createTestUser } from "../helpers/db";

beforeAll(() => {
  vi.stubEnv("AUTH_SECRET", "integration-secret-0123456789abcdef");
});

const now = () => Date.now();

describe("two-factor sign-in", () => {
  it("is off until the first code is confirmed", async () => {
    const u = await createTestUser("tf");
    expect(await isTwoFactorEnabled(u.id)).toBe(false);
    const begun = (await beginSetup(u.id))!;
    expect(begun.secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(await isTwoFactorEnabled(u.id)).toBe(false); // pending
    expect(await pendingSecret(u.id)).toBe(begun.secret);
    expect(await checkSecondFactor(u.id, codeAtStep(begun.secret, stepAt(now())))).toBe(false); // not active yet
    expect(await confirmSetup(u.id, "000000")).toBeNull();
    expect(await isTwoFactorEnabled(u.id)).toBe(false);
  });

  it("stores the secret encrypted, never in clear", async () => {
    const u = await createTestUser("tf");
    const { secret } = (await beginSetup(u.id))!;
    const [row] = await db.select({ s: users.totpSecret }).from(users).where(eq(users.id, u.id));
    expect(row.s).toBeTruthy();
    expect(row.s).not.toContain(secret);
  });

  it("turns on with the right code, hands out 8 backup codes and keeps only their hashes", async () => {
    const u = await createTestUser("tf");
    const { secret } = (await beginSetup(u.id))!;
    const codes = (await confirmSetup(u.id, codeAtStep(secret, stepAt(now()))))!;
    expect(codes).toHaveLength(8);
    expect(await isTwoFactorEnabled(u.id)).toBe(true);
    expect(await backupCodesLeft(u.id)).toBe(8);
    const [row] = await db.select({ b: users.totpBackup }).from(users).where(eq(users.id, u.id));
    for (const c of codes) expect(row.b).not.toContain(c.replace("-", ""));
    expect(await beginSetup(u.id)).toBeNull(); // already on
  });

  it("accepts a code once; the same code again, or an old one, is refused", async () => {
    const u = await createTestUser("tf");
    const { secret } = (await beginSetup(u.id))!;
    const step = stepAt(now());
    await confirmSetup(u.id, codeAtStep(secret, step)); // consumes this step
    expect(await checkSecondFactor(u.id, codeAtStep(secret, step))).toBe(false); // replay
    expect(await checkSecondFactor(u.id, codeAtStep(secret, step - 1))).toBe(false); // older than the last used
    expect(await checkSecondFactor(u.id, codeAtStep(secret, step + 1))).toBe(true); // the next one is fine
    expect(await checkSecondFactor(u.id, codeAtStep(secret, step + 1))).toBe(false); // but only once
    expect(await checkSecondFactor(u.id, "123456")).toBe(false);
    expect(await checkSecondFactor(u.id, "")).toBe(false);
  });

  it("a backup code works exactly once", async () => {
    const u = await createTestUser("tf");
    const { secret } = (await beginSetup(u.id))!;
    const codes = (await confirmSetup(u.id, codeAtStep(secret, stepAt(now()))))!;
    expect(await checkSecondFactor(u.id, codes[0].toUpperCase())).toBe(true); // case does not matter
    expect(await checkSecondFactor(u.id, codes[0])).toBe(false);
    expect(await backupCodesLeft(u.id)).toBe(7);
    expect(await checkSecondFactor(u.id, codes[1].replace("-", ""))).toBe(true); // nor does the dash
    expect(await checkSecondFactor(u.id, "aaaa-bbbb")).toBe(false);
  });

  it("two requests with the same backup code: only one wins", async () => {
    const u = await createTestUser("tf");
    const { secret } = (await beginSetup(u.id))!;
    const codes = (await confirmSetup(u.id, codeAtStep(secret, stepAt(now()))))!;
    const results = await Promise.all([checkSecondFactor(u.id, codes[2]), checkSecondFactor(u.id, codes[2])]);
    expect(results.filter(Boolean)).toHaveLength(1);
  });

  it("one user's code means nothing for another user", async () => {
    const a = await createTestUser("tf");
    const b = await createTestUser("tf");
    const { secret } = (await beginSetup(a.id))!;
    await confirmSetup(a.id, codeAtStep(secret, stepAt(now())));
    const sb = (await beginSetup(b.id))!;
    await confirmSetup(b.id, codeAtStep(sb.secret, stepAt(now())));
    expect(await checkSecondFactor(b.id, codeAtStep(secret, stepAt(now()) + 1))).toBe(false);
  });

  it("turning it off forgets everything", async () => {
    const u = await createTestUser("tf");
    const { secret } = (await beginSetup(u.id))!;
    await confirmSetup(u.id, codeAtStep(secret, stepAt(now())));
    await disableTwoFactor(u.id);
    expect(await isTwoFactorEnabled(u.id)).toBe(false);
    expect(await checkSecondFactor(u.id, codeAtStep(secret, stepAt(now()) + 1))).toBe(false);
    const [row] = await db.select({ s: users.totpSecret, b: users.totpBackup }).from(users).where(eq(users.id, u.id));
    expect(row).toEqual({ s: null, b: null });
  });
});

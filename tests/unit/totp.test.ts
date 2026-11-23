import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  base32Decode,
  base32Encode,
  codeAtStep,
  decryptSecret,
  encryptSecret,
  generateBackupCodes,
  generateSecret,
  groupSecret,
  hashBackupCode,
  looksLikeBackupCode,
  otpauthUri,
  stepAt,
  verifyTotp,
} from "@/lib/totp";

// The secret "12345678901234567890" from RFC 6238, in base32
const RFC_SECRET = base32Encode(Buffer.from("12345678901234567890"));

beforeEach(() => {
  vi.stubEnv("AUTH_SECRET", "unit-test-secret-0123456789abcdef");
});

describe("authenticator codes (RFC 6238)", () => {
  it("matches the published test vectors", () => {
    // 8-digit values from the RFC; the 6-digit code is their last six digits
    const vectors: [number, string][] = [
      [59, "94287082"],
      [1111111109, "07081804"],
      [1111111111, "14050471"],
      [1234567890, "89005924"],
      [2000000000, "69279037"],
    ];
    for (const [seconds, eight] of vectors) {
      expect(codeAtStep(RFC_SECRET, stepAt(seconds * 1000), 8)).toBe(eight);
      expect(codeAtStep(RFC_SECRET, stepAt(seconds * 1000))).toBe(eight.slice(-6));
    }
  });

  it("base32 round-trips", () => {
    const raw = Buffer.from([0, 1, 2, 250, 251, 252, 253, 254, 255, 7]);
    expect(base32Decode(base32Encode(raw))).toEqual(raw);
    expect(base32Decode("gezd gnbv gy3t qojq")).toEqual(Buffer.from("1234567890"));
    expect(() => base32Decode("not base32!!")).toThrow();
  });

  it("generates a 160-bit secret that apps accept", () => {
    const s = generateSecret();
    expect(s).toMatch(/^[A-Z2-7]{32}$/);
    expect(generateSecret()).not.toBe(s);
    expect(groupSecret(s)).toMatch(/^([A-Z2-7]{4} ){7}[A-Z2-7]{4}$/);
  });

  it("accepts the current code and one step either side, nothing else", () => {
    const now = 1_700_000_000_000;
    const step = stepAt(now);
    for (const s of [step - 1, step, step + 1]) expect(verifyTotp(RFC_SECRET, codeAtStep(RFC_SECRET, s), now)).toBe(s);
    expect(verifyTotp(RFC_SECRET, codeAtStep(RFC_SECRET, step + 2), now)).toBeNull();
    expect(verifyTotp(RFC_SECRET, codeAtStep(RFC_SECRET, step - 2), now)).toBeNull();
  });

  it("tolerates spaces and refuses malformed input", () => {
    const now = 1_700_000_000_000;
    const code = codeAtStep(RFC_SECRET, stepAt(now));
    expect(verifyTotp(RFC_SECRET, `${code.slice(0, 3)} ${code.slice(3)}`, now)).not.toBeNull();
    for (const bad of ["", "12345", "1234567", "abcdef", "12 34", "000000".replace(/0/g, "x")]) expect(verifyTotp(RFC_SECRET, bad, now)).toBeNull();
  });

  it("refuses a code that was already used", () => {
    const now = 1_700_000_000_000;
    const step = stepAt(now);
    const code = codeAtStep(RFC_SECRET, step);
    expect(verifyTotp(RFC_SECRET, code, now, step - 1)).toBe(step);
    expect(verifyTotp(RFC_SECRET, code, now, step)).toBeNull(); // used
    expect(verifyTotp(RFC_SECRET, code, now, step + 1)).toBeNull();
  });

  it("builds the link authenticator apps read from the QR code", () => {
    const uri = otpauthUri("ABCDEFGH", "anna@gmail.com");
    expect(uri).toBe("otpauth://totp/Kapio:anna%40gmail.com?secret=ABCDEFGH&issuer=Kapio&algorithm=SHA1&digits=6&period=30");
  });
});

describe("keeping secrets safe", () => {
  it("encrypts so the stored text is not the secret, and decrypts it back", () => {
    const secret = generateSecret();
    const stored = encryptSecret(secret);
    expect(stored).not.toContain(secret);
    expect(decryptSecret(stored)).toBe(secret);
    expect(encryptSecret(secret)).not.toBe(stored); // a fresh nonce every time
  });

  it("refuses tampered or foreign data", () => {
    const stored = encryptSecret("SECRETSECRET");
    const raw = Buffer.from(stored, "base64");
    raw[raw.length - 1] ^= 1;
    expect(() => decryptSecret(raw.toString("base64"))).toThrow();
    vi.stubEnv("AUTH_SECRET", "a-different-secret-entirely-0123456");
    expect(() => decryptSecret(stored)).toThrow(); // another key can not read it
  });
});

describe("backup codes", () => {
  it("makes eight distinct, readable codes", () => {
    const codes = generateBackupCodes();
    expect(codes).toHaveLength(8);
    expect(new Set(codes).size).toBe(8);
    for (const c of codes) {
      expect(c).toMatch(/^[a-z2-9]{4}-[a-z2-9]{4}$/);
      expect(c).not.toMatch(/[0o1li]/);
      expect(looksLikeBackupCode(c)).toBe(true);
    }
  });

  it("hashes without caring about case or the dash", () => {
    expect(hashBackupCode("k3f9-m2xq")).toBe(hashBackupCode("K3F9M2XQ"));
    expect(hashBackupCode("k3f9-m2xq")).not.toBe(hashBackupCode("k3f9-m2xr"));
    expect(hashBackupCode("k3f9-m2xq")).not.toContain("k3f9");
  });

  it("tells a backup code from a 6-digit code", () => {
    expect(looksLikeBackupCode("123456")).toBe(false);
    expect(looksLikeBackupCode("k3f9m2xq")).toBe(true);
    expect(looksLikeBackupCode(" k3f9-m2xq ")).toBe(true);
    expect(looksLikeBackupCode("k3f9-m2")).toBe(false);
  });
});

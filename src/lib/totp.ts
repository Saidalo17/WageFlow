import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

/**
 * Two-factor sign-in with an authenticator app (TOTP, RFC 6238): 6 digits that change every 30 seconds,
 * plus one-time backup codes for a lost phone.
 */

const STEP_SECONDS = 30;
const DIGITS = 6;
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

// ---------- Base32 (what authenticator apps expect) ----------

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(text: string): Buffer {
  const clean = text.replace(/[\s=-]/g, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const i = B32.indexOf(ch);
    if (i < 0) throw new Error("bad base32");
    value = (value << 5) | i;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

// ---------- TOTP ----------

export function generateSecret(): string {
  return base32Encode(randomBytes(20));
}

/** The code for one 30-second step. */
export function codeAtStep(secret: string, step: number, digits = DIGITS): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const hmac = createHmac("sha1", base32Decode(secret)).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 15;
  const bin = ((hmac[offset] & 0x7f) << 24) | (hmac[offset + 1] << 16) | (hmac[offset + 2] << 8) | hmac[offset + 3];
  return String(bin % 10 ** digits).padStart(digits, "0");
}

export const stepAt = (ms: number) => Math.floor(ms / 1000 / STEP_SECONDS);

/**
 * Checks a typed code against the current step and one step either side (clocks differ a little).
 * Returns the step that matched, or null. A step at or before `lastUsedStep` is refused, so one code works once.
 */
export function verifyTotp(secret: string, input: string, now = Date.now(), lastUsedStep: number | null = null): number | null {
  const code = input.replace(/\s/g, "");
  if (!/^\d{6}$/.test(code)) return null;
  const current = stepAt(now);
  let matched: number | null = null;
  for (const step of [current - 1, current, current + 1]) {
    const expected = Buffer.from(codeAtStep(secret, step));
    const given = Buffer.from(code);
    // compare every candidate, so the time taken does not show which one was close
    if (expected.length === given.length && timingSafeEqual(expected, given) && (lastUsedStep === null || step > lastUsedStep)) matched = step;
  }
  return matched;
}

export function otpauthUri(secret: string, account: string, issuer = "Kapio"): string {
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(account)}`;
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${DIGITS}&period=${STEP_SECONDS}`;
}

/** "ABCD EFGH IJKL ..." for typing by hand. */
export const groupSecret = (secret: string) => secret.replace(/(.{4})/g, "$1 ").trim();

// ---------- Keeping the secret safe in the database ----------

function key(purpose: string): Buffer {
  const base = process.env.AUTH_SECRET;
  if (!base) throw new Error("AUTH_SECRET is not set");
  return createHash("sha256").update(`${purpose}:${base}`).digest();
}

/** AES-256-GCM: a copy of the database alone does not reveal the secrets. */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key("totp-secret"), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), enc]).toString("base64");
}

export function decryptSecret(stored: string): string {
  const raw = Buffer.from(stored, "base64");
  const decipher = createDecipheriv("aes-256-gcm", key("totp-secret"), raw.subarray(0, 12));
  decipher.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
}

// ---------- Backup codes ----------

const CODE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"; // no look-alikes (0/o, 1/l/i)
export const BACKUP_CODE_COUNT = 8;

/** Eight codes like "k3f9-m2xq", shown once. Only a keyed hash of each is kept. */
export function generateBackupCodes(): string[] {
  return Array.from({ length: BACKUP_CODE_COUNT }, () => {
    const raw = Array.from({ length: 8 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");
    return `${raw.slice(0, 4)}-${raw.slice(4)}`;
  });
}

const normalizeBackup = (code: string) => code.toLowerCase().replace(/[^a-z0-9]/g, "");

export function hashBackupCode(code: string): string {
  return createHmac("sha256", key("totp-backup")).update(normalizeBackup(code)).digest("hex");
}

/** True when the text has the shape of a backup code (8 letters/digits, dash optional). */
export const looksLikeBackupCode = (input: string) => /^[a-zA-Z0-9]{4}-?[a-zA-Z0-9]{4}$/.test(input.trim());

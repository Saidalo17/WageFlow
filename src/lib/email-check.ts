import { resolve4, resolve6, resolveMx } from "node:dns/promises";
import { isReservedDomain } from "@/lib/validators/auth";

/**
 * Is it plausible that this address can receive mail? Server only, used when an account is created.
 *  - reserved/test domains (example.com, *.test, localhost, ...) are refused;
 *  - the domain must exist and accept mail: an MX record, or (as the standard says) an address record;
 *  - a domain that says "no mail here" (a "null MX") is refused.
 * Network trouble (timeouts, a broken resolver) never blocks anybody: the check then says "ok".
 */
export type DomainCheck = "ok" | "reserved" | "no-mail";

export type Resolver = {
  mx: (domain: string) => Promise<{ exchange: string }[]>;
  addresses: (domain: string) => Promise<unknown[]>;
};

const defaultResolver: Resolver = {
  mx: (d) => resolveMx(d),
  addresses: async (d) => {
    const [a, aaaa] = await Promise.allSettled([resolve4(d), resolve6(d)]);
    const list = [a, aaaa].flatMap((r) => (r.status === "fulfilled" ? r.value : []));
    if (list.length > 0) return list;
    // Neither exists: say "not found" only if both said so; otherwise it was a network problem.
    const codes = [a, aaaa].map((r) => (r.status === "rejected" ? (r.reason as { code?: string }).code : "ok"));
    if (codes.every((c) => c === "ENOTFOUND" || c === "ENODATA")) return [];
    throw Object.assign(new Error("dns"), { code: "ESERVFAIL" });
  },
};

const NOT_FOUND = new Set(["ENOTFOUND", "ENODATA"]);
const TIMEOUT_MS = 3000;

function withTimeout<T>(promise: Promise<T>): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(Object.assign(new Error("timeout"), { code: "ETIMEOUT" })), TIMEOUT_MS)),
  ]);
}

/** The check is on in production and off elsewhere, unless EMAIL_DELIVERABILITY_CHECK says "on" or "off". */
export function deliverabilityCheckEnabled(): boolean {
  const flag = process.env.EMAIL_DELIVERABILITY_CHECK;
  if (flag === "on") return true;
  if (flag === "off") return false;
  return process.env.NODE_ENV === "production";
}

export async function checkEmailDomain(email: string, resolver: Resolver = defaultResolver): Promise<DomainCheck> {
  const domain = email.slice(email.lastIndexOf("@") + 1).toLowerCase();
  if (isReservedDomain(domain)) return "reserved";

  try {
    const mx = await withTimeout(resolver.mx(domain));
    if (mx.length > 0) {
      // A single MX of "." is the standard way to say "this domain accepts no mail".
      return mx.every((m) => m.exchange === "" || m.exchange === ".") ? "no-mail" : "ok";
    }
  } catch (e) {
    if (!NOT_FOUND.has((e as { code?: string }).code ?? "")) return "ok"; // network trouble: do not block
  }

  try {
    return (await withTimeout(resolver.addresses(domain))).length > 0 ? "ok" : "no-mail";
  } catch (e) {
    return NOT_FOUND.has((e as { code?: string }).code ?? "") ? "no-mail" : "ok";
  }
}

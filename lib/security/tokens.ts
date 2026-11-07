import "server-only";
import crypto from "node:crypto";
import { subKey } from "./secrets";

/**
 * Three NON-interchangeable bearer secret types (+ internal ones):
 *   customer  dwc_…  (paid dashboard access, issued only after verified payment)
 *   affiliate dwa_…  (owner-provisioned sales-rep access)
 *   guest     /i/<43 chars>  (one guest, one invitation, expires 7 days after creation)
 *   receipt   dwr_…  (order receipt / recovery code shown at checkout)
 * Each type has its own prefix AND its own table, and is stored only as an HMAC-SHA256 hash
 * (keyed with a server secret), so a database leak does not reveal usable credentials.
 */
export type SecretKind = "customer" | "affiliate" | "receipt";
const PREFIX: Record<SecretKind, string> = { customer: "dwc_", affiliate: "dwa_", receipt: "dwr_" };
const B32 = "abcdefghjkmnpqrstuvwxyz23456789"; // 31 symbols, no 0/o/1/l/i ambiguity

function randomString(len: number, alphabet = B32): string {
  const out: string[] = [];
  const max = Math.floor(256 / alphabet.length) * alphabet.length;
  while (out.length < len) {
    for (const b of crypto.randomBytes(len * 2)) {
      if (b < max) out.push(alphabet[b % alphabet.length]);
      if (out.length === len) break;
    }
  }
  return out.join("");
}

export function hashSecret(raw: string): string {
  return crypto.createHmac("sha256", subKey("token-hmac")).update(raw).digest("hex");
}

/** 32 symbols of a 31-letter alphabet ≈ 158 bits of entropy. */
export function newSecret(kind: SecretKind): { raw: string; hash: string; hint: string } {
  const body = randomString(32);
  const raw = PREFIX[kind] + body;
  return { raw, hash: hashSecret(raw), hint: body.slice(-4) };
}

/** Accepts pasted input with spaces, dashes, or different case; rejects the wrong token type. */
export function normalizeSecret(input: string, kind: SecretKind): string | null {
  const s = (input || "").normalize("NFKC").trim().toLowerCase().replace(/[\s\-‐-―]/g, "");
  const p = PREFIX[kind];
  if (!s.startsWith(p)) return null;
  const body = s.slice(p.length);
  if (body.length !== 32) return null;
  for (const ch of body) if (!B32.includes(ch)) return null;
  return p + body;
}

/** Formats a secret in groups of 4 for easier copying on paper. */
export function formatSecret(raw: string): string {
  const i = raw.indexOf("_");
  const body = raw.slice(i + 1).match(/.{1,4}/g)?.join("-") ?? raw;
  return raw.slice(0, i + 1) + body;
}

/** Guest link token: 32 random bytes, base64url (43 chars, URL-safe, no name or ID inside). */
export function newGuestToken(): { raw: string; hash: string } {
  const raw = crypto.randomBytes(32).toString("base64url");
  return { raw, hash: hashSecret("g:" + raw) };
}
export function hashGuestToken(raw: string): string | null {
  if (!/^[A-Za-z0-9_-]{43}$/.test(raw || "")) return null;
  return hashSecret("g:" + raw);
}

export function newSessionId(): { raw: string; hash: string } {
  const raw = crypto.randomBytes(32).toString("base64url");
  return { raw, hash: hashSecret("s:" + raw) };
}
export function hashSessionId(raw: string): string | null {
  if (!/^[A-Za-z0-9_-]{43}$/.test(raw || "")) return null;
  return hashSecret("s:" + raw);
}

/** Human-friendly, non-sequential, NON-secret order reference, e.g. DW-7KQ4-M9XT. */
export function newOrderReference(): string {
  const a = randomString(8, "ABCDEFGHJKMNPQRSTUVWXYZ23456789");
  return `DW-${a.slice(0, 4)}-${a.slice(4)}`;
}

export function newCsrfToken(): string {
  return crypto.randomBytes(24).toString("base64url");
}

export function randomId(bytes = 16): string {
  return crypto.randomBytes(bytes).toString("base64url");
}

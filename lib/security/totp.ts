import "server-only";
import crypto from "node:crypto";

/** RFC 6238 TOTP (SHA-1, 30 s, 6 digits) — works with Google Authenticator, Microsoft Authenticator, Authy, 1Password. */
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function newTotpSecret(): string {
  const bytes = crypto.randomBytes(20);
  let bits = "";
  for (const b of bytes) bits += b.toString(2).padStart(8, "0");
  let out = "";
  for (let i = 0; i + 5 <= bits.length; i += 5) out += B32[parseInt(bits.slice(i, i + 5), 2)];
  return out;
}

function base32Decode(s: string): Buffer {
  const clean = s.replace(/=+$/, "").toUpperCase().replace(/\s/g, "");
  let bits = "";
  for (const ch of clean) {
    const v = B32.indexOf(ch);
    if (v < 0) throw new Error("bad base32");
    bits += v.toString(2).padStart(5, "0");
  }
  const out: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) out.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(out);
}

export function totpAt(secret: string, step: number): string {
  const key = base32Decode(secret);
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(step));
  const h = crypto.createHmac("sha1", key).update(msg).digest();
  const o = h[h.length - 1] & 0xf;
  return ((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).toString().padStart(6, "0");
}

/**
 * Verifies a code within ±1 step. Returns the matched step, which must be greater than the last
 * accepted step (prevents replaying a code that was already used), or null.
 */
export function verifyTotp(secret: string, code: string, lastStep: number, nowMs = Date.now()): number | null {
  const c = (code || "").replace(/\s/g, "");
  if (!/^\d{6}$/.test(c)) return null;
  const cur = Math.floor(nowMs / 30000);
  for (const s of [cur - 1, cur, cur + 1]) {
    if (s <= lastStep) continue;
    if (crypto.timingSafeEqual(Buffer.from(totpAt(secret, s)), Buffer.from(c))) return s;
  }
  return null;
}

export function otpauthUrl(secret: string, account: string, issuer: string): string {
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

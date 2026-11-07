import "server-only";
import crypto from "node:crypto";
import { subKey } from "./secrets";

/** AES-256-GCM authenticated encryption → base64url(iv | tag | ciphertext). */
export function encrypt(plain: string, purpose: "guest-link-enc" | "totp-enc"): string {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", subKey(purpose), iv);
  const ct = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), ct]).toString("base64url");
}

export function decrypt(blob: string, purpose: "guest-link-enc" | "totp-enc"): string {
  const b = Buffer.from(blob, "base64url");
  const d = crypto.createDecipheriv("aes-256-gcm", subKey(purpose), b.subarray(0, 12));
  d.setAuthTag(b.subarray(12, 28));
  return Buffer.concat([d.update(b.subarray(28)), d.final()]).toString("utf8");
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) {
    crypto.timingSafeEqual(ab, ab);
    return false;
  }
  return crypto.timingSafeEqual(ab, bb);
}

export function hashIp(ip: string): string {
  if (!ip) return "";
  return crypto.createHmac("sha256", subKey("ip-hash")).update(ip).digest("base64url").slice(0, 22);
}

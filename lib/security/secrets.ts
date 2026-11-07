import "server-only";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

let cached: Buffer | null = null;

/**
 * APP_SECRET is the root key (≥32 random bytes, base64/hex/any string ≥ 32 chars).
 * Sub-keys are derived with HKDF so one secret never serves two purposes.
 * In development a random secret is generated once into .data/app-secret (git-ignored).
 */
export function appSecret(): Buffer {
  if (cached) return cached;
  const env = process.env.APP_SECRET;
  if (env && env.length >= 32) {
    cached = Buffer.from(env, "utf8");
    return cached;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("APP_SECRET (at least 32 characters) must be set in production.");
  }
  const file = path.join(process.cwd(), ".data", "app-secret");
  try {
    cached = Buffer.from(fs.readFileSync(file, "utf8").trim(), "utf8");
  } catch {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const s = crypto.randomBytes(48).toString("base64url");
    fs.writeFileSync(file, s, { mode: 0o600 });
    cached = Buffer.from(s, "utf8");
  }
  return cached;
}

const derived = new Map<string, Buffer>();
export function subKey(purpose: "token-hmac" | "guest-link-enc" | "totp-enc" | "ip-hash"): Buffer {
  let k = derived.get(purpose);
  if (!k) {
    k = Buffer.from(crypto.hkdfSync("sha256", appSecret(), Buffer.from("dawati-v1"), Buffer.from(purpose), 32));
    derived.set(purpose, k);
  }
  return k;
}

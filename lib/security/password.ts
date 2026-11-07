import "server-only";
import crypto from "node:crypto";

const N = 32768;
const R = 8;
const P = 1;
const KEYLEN = 64;

function scrypt(pw: string, salt: Buffer, n: number, r: number, p: number): Promise<Buffer> {
  return new Promise((res, rej) =>
    crypto.scrypt(pw.normalize("NFKC"), salt, KEYLEN, { N: n, r, p, maxmem: 128 * n * r * 2 }, (e, k) => (e ? rej(e) : res(k))),
  );
}

export async function hashPassword(pw: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const k = await scrypt(pw, salt, N, R, P);
  return ["scrypt", N, R, P, salt.toString("base64url"), k.toString("base64url")].join("$");
}

export async function verifyPassword(pw: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, n, r, p, salt, hash] = parts;
  const k = await scrypt(pw, Buffer.from(salt, "base64url"), Number(n), Number(r), Number(p));
  const h = Buffer.from(hash, "base64url");
  return h.length === k.length && crypto.timingSafeEqual(h, k);
}

/** Owner password policy (Arabic error message). */
export function passwordProblem(pw: string): string | null {
  if (pw.length < 12) return "يجب أن تتكون كلمة المرور من 12 حرفاً على الأقل";
  if (pw.length > 200) return "كلمة المرور طويلة جداً";
  if (!/[A-Za-z؀-ۿ]/.test(pw) || !/[0-9]/.test(pw)) return "يجب أن تحتوي كلمة المرور على حروف وأرقام";
  return null;
}

/** A real hash of a random value, used to equalise timing when the username does not exist. */
let dummy: Promise<string> | null = null;
export function dummyHash(): Promise<string> {
  if (!dummy) dummy = hashPassword(crypto.randomBytes(16).toString("hex"));
  return dummy;
}

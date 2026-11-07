import "server-only";
import { headers } from "next/headers";

/** Client IP as seen by the platform proxy (first X-Forwarded-For hop). Used only for rate limits and hashed logs. */
export async function clientIp(): Promise<string> {
  const h = await headers();
  const xff = h.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return h.get("x-real-ip") || "";
}

export async function userAgent(): Promise<string> {
  return ((await headers()).get("user-agent") || "").slice(0, 300);
}

/** Messaging-app link-preview crawlers must never count as a guest opening a link. */
const BOT_RE =
  /(bot|crawler|spider|preview|facebookexternalhit|whatsapp|telegram|slack|discord|skype|twitter|linkedin|embedly|quora|pinterest|vkshare|w3c_validator|headless)/i;
export function isBotUa(ua: string): boolean {
  return !ua || BOT_RE.test(ua);
}

/** Same-origin check for state-changing route handlers (Server Actions get this check from Next.js itself). */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") return false;
  if (!origin) return site === "same-origin";
  try {
    const o = new URL(origin);
    const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
    return o.host === host;
  } catch {
    return false;
  }
}

export function publicBaseUrl(h?: Headers): string {
  const env = process.env.PUBLIC_BASE_URL;
  if (env) return env.replace(/\/$/, "");
  if (h) {
    const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
    const proto = h.get("x-forwarded-proto") || (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
    return `${proto}://${host}`;
  }
  return "http://localhost:3000";
}

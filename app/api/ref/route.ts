import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { recordReferralVisit } from "@/lib/services/affiliates";
import { hashSecret, randomId } from "@/lib/security/tokens";
import { isBotUa } from "@/lib/security/request";
import { rateLimit } from "@/lib/security/rateLimit";
import { hashIp } from "@/lib/security/crypto";
import { secureCookies } from "@/lib/security/sessions";
import { VISITOR_COOKIE, REF_COOKIE } from "@/lib/auth";
import { normalizeReferralCode } from "@/lib/services/orders";

export const dynamic = "force-dynamic";

function safeNext(n: string | null): string {
  if (!n || !n.startsWith("/") || n.startsWith("//") || n.startsWith("/api/")) return "/";
  return n.slice(0, 300);
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code") || "";
  const next = safeNext(req.nextUrl.searchParams.get("next"));
  const res = NextResponse.redirect(new URL(next, req.url), 302);
  res.headers.set("Cache-Control", "no-store");
  const ua = req.headers.get("user-agent") || "";
  // Link-preview crawlers (WhatsApp, Telegram…) are redirected without being counted.
  if (isBotUa(ua)) return res;
  let vid = req.cookies.get(VISITOR_COOKIE)?.value;
  if (!vid || !/^[A-Za-z0-9_-]{22}$/.test(vid)) vid = randomId(16);
  try {
    const db = await getDb();
    const ip = hashIp(req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "");
    if (await rateLimit(db, `ref:${ip}`, 60, 3600)) {
      const ok = await recordReferralVisit(db, code, hashSecret("v:" + vid), next);
      // remembered so "order now" buttons contact the representative who shared the link
      if (ok) res.cookies.set(REF_COOKIE, normalizeReferralCode(code), { httpOnly: true, secure: secureCookies(), sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
    }
  } catch (e) {
    console.error("referral capture failed", e);
  }
  res.cookies.set(VISITOR_COOKIE, vid, { httpOnly: true, secure: secureCookies(), sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
  return res;
}

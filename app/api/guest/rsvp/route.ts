import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { submitRsvp } from "@/lib/services/guests";
import { sameOrigin } from "@/lib/security/request";
import { hashIp } from "@/lib/security/crypto";
import { rateLimit } from "@/lib/security/rateLimit";

export const dynamic = "force-dynamic";

/** Guest RSVP. The bearer token travels in the JSON body (not in a query string). */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "طلب غير مسموح" }, { status: 403 });
  let body: { token?: unknown; status?: unknown; partySize?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }
  const db = await getDb();
  const ip = hashIp(req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "");
  if (!(await rateLimit(db, `rsvp-ip:${ip}`, 60, 600))) return NextResponse.json({ error: "محاولات كثيرة، حاولوا لاحقاً" }, { status: 429 });
  const r = await submitRsvp(db, String(body.token || ""), body.status as "accepted" | "declined", Number(body.partySize || 0), ip);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.code });
  return NextResponse.json({ ok: true });
}

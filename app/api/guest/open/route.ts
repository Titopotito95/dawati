import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { markGuestOpened } from "@/lib/services/guests";
import { isBotUa, sameOrigin } from "@/lib/security/request";

export const dynamic = "force-dynamic";

/** Called by the page only after a human taps the seal. Opening ≠ confirming attendance. */
export async function POST(req: Request) {
  if (!sameOrigin(req) || isBotUa(req.headers.get("user-agent") || "")) return NextResponse.json({ ok: false }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const db = await getDb();
  await markGuestOpened(db, String((body as { token?: string }).token || ""));
  return NextResponse.json({ ok: true });
}

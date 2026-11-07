import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { getObject, isMediaKey } from "@/lib/services/storage";

export const dynamic = "force-dynamic";

/** Serves uploaded invitation media by unguessable key. Deleted assets are never served. */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ key: string }> }) {
  const { key } = await ctx.params;
  if (!isMediaKey(key)) return new NextResponse("غير موجود", { status: 404 });
  const db = await getDb();
  const r = await db.query<{ mime: string }>(`select mime from invitation_assets where storage_key = $1 and deleted_at is null`, [key]);
  if (!r.rows[0]) return new NextResponse("غير موجود", { status: 404 });
  const obj = await getObject(key);
  if (!obj) return new NextResponse("غير موجود", { status: 404 });
  return new NextResponse(new Uint8Array(obj.body), {
    headers: {
      "Content-Type": r.rows[0].mime,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
      "Cross-Origin-Resource-Policy": "same-origin",
    },
  });
}

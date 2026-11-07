import "server-only";
import { cookies } from "next/headers";
import type { Queryable } from "@/lib/db";
import { getSettings } from "@/lib/services/settings";
import { BRAND } from "@/lib/brand";
import { REF_COOKIE } from "@/lib/auth";

export interface OrderContact {
  name: string | null;
  whatsappUrl: string | null;
  viaAffiliate: boolean;
}

function wa(phone: string, text: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 7) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

/** Ordering happens person-to-person: route the visitor to the representative who referred them, else to the business. */
export async function orderContact(q: Queryable, themeName?: string): Promise<OrderContact> {
  const text = themeName ? `السلام عليكم، أرغب في طلب دعوة "${themeName}"` : "السلام عليكم، أرغب في طلب دعوة رقمية";
  const code = (await cookies()).get(REF_COOKIE)?.value;
  if (code && /^[A-Z0-9]{4,20}$/.test(code)) {
    const r = await q.query<{ name: string; phone: string }>(`select name, phone from affiliates where referral_code = $1 and status = 'active'`, [code]);
    const a = r.rows[0];
    const url = a?.phone ? wa(a.phone, text) : null;
    if (a && url) return { name: a.name, whatsappUrl: url, viaAffiliate: true };
  }
  const s = await getSettings(q);
  const phone = s.contactWhatsapp || BRAND.whatsapp;
  return { name: null, whatsappUrl: phone ? wa(phone, text) : null, viaAffiliate: false };
}

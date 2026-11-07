"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { resolveAffiliateToken } from "@/lib/services/affiliates";
import { issueCustomerAccess } from "@/lib/services/orders";
import { getThemeBySlug } from "@/lib/services/catalog";
import { createSession, destroySession } from "@/lib/security/sessions";
import { rateLimit } from "@/lib/security/rateLimit";
import { clientIp } from "@/lib/security/request";
import { hashIp } from "@/lib/security/crypto";
import { audit } from "@/lib/security/audit";
import { requireAffiliate } from "@/lib/auth";
import { parseMajorToMinor } from "@/lib/money";
import { userMessage, UserError } from "@/lib/services/errors";
import type { ActionResult } from "@/components/ui/ActionForm";

export async function redeemAffiliateToken(_p: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const db = await getDb();
  const ip = hashIp(await clientIp());
  if (!(await rateLimit(db, `redeem-a:${ip}`, 10, 900))) return { ok: false, message: "محاولات كثيرة، يرجى المحاولة بعد 15 دقيقة" };
  const r = await resolveAffiliateToken(db, String(fd.get("token") || ""));
  if ("error" in r) return { ok: false, message: r.error };
  await createSession(db, "affiliate", r.affiliateId);
  await audit(db, { actorType: "affiliate", actorId: r.affiliateId, action: "affiliate.login", ipHash: ip });
  redirect("/affiliate/dashboard");
}

export async function logoutAffiliate() {
  await destroySession("affiliate");
  redirect("/affiliate?bye=1");
}

export async function affiliateIssueAction(_p: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const { db, affiliate } = await requireAffiliate();
  try {
    if (!affiliate.canIssueTokens) throw new UserError("غير مصرح لك بإصدار رموز للعملاء", "forbidden");
    const ip = hashIp(await clientIp());
    if (!(await rateLimit(db, `issue-a:${affiliate.id}`, 40, 3600))) throw new UserError("عدد كبير من العمليات، حاول لاحقاً");
    const theme = await getThemeBySlug(db, String(fd.get("theme") || ""));
    if (!theme) throw new UserError("اختر تصميماً");
    const amount = parseMajorToMinor(String(fd.get("amount") || ""), theme.currency);
    if (amount === null || amount <= 0) throw new UserError("المبلغ المستلم غير صحيح");
    const r = await issueCustomerAccess(db, {
      issuer: { type: "affiliate", id: affiliate.id },
      customerName: String(fd.get("customerName") || ""),
      customerPhone: String(fd.get("customerPhone") || ""),
      themeSlug: theme.slug,
      variantKey: String(fd.get("variant") || ""),
      guestLimit: Number(fd.get("guestLimit")),
      amountMinor: amount,
      note: String(fd.get("note") || ""),
      idempotencyKey: String(fd.get("idem") || ""),
      ipHash: ip,
    });
    if (r.kind === "duplicate") return { ok: false, message: `تم إصدار هذا الطلب مسبقاً (${r.reference}). لإصدار رمز بديل تواصل مع الإدارة.` };
    revalidatePath("/affiliate/dashboard", "layout");
    return { ok: true, message: "تم تسجيل البيع وإصدار رمز العميل", data: { token: r.token, reference: r.reference, phone: String(fd.get("customerPhone") || "") } };
  } catch (e) {
    return { ok: false, message: userMessage(e) };
  }
}

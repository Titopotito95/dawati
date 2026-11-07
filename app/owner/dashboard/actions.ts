"use server";
import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth";
import { issueCustomerAccess, ownerReissueCustomerToken, setGuestLimit, extendAccess, setWorkspaceStatus, recordRefund } from "@/lib/services/orders";
import { getThemeBySlug } from "@/lib/services/catalog";
import { createAffiliate, updateAffiliate, issueAffiliateToken } from "@/lib/services/affiliates";
import { approveCommissions, recordPayout, markCashRemitted } from "@/lib/services/commissions";
import { saveSettings, type Settings } from "@/lib/services/settings";
import { audit } from "@/lib/security/audit";
import { clientIp } from "@/lib/security/request";
import { hashIp } from "@/lib/security/crypto";
import { parseMajorToMinor, formatMoney } from "@/lib/money";
import { userMessage, UserError } from "@/lib/services/errors";
import { randomId } from "@/lib/security/tokens";
import type { ActionResult } from "@/components/ui/ActionForm";

const s = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const done = (message: string, data?: Record<string, unknown>): ActionResult => {
  revalidatePath("/owner/dashboard", "layout");
  return { ok: true, message, data };
};
const fail = (e: unknown): ActionResult => ({ ok: false, message: userMessage(e) });

export async function ownerIssueAction(_p: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const { db, ownerId } = await requireOwner();
  try {
    const theme = await getThemeBySlug(db, s(fd, "theme"));
    if (!theme) throw new UserError("اختر تصميماً");
    const amount = parseMajorToMinor(s(fd, "amount"), theme.currency);
    if (amount === null || amount <= 0) throw new UserError("المبلغ المستلم غير صحيح");
    const r = await issueCustomerAccess(db, {
      issuer: { type: "owner", id: ownerId },
      customerName: s(fd, "customerName"),
      customerPhone: s(fd, "customerPhone"),
      themeSlug: theme.slug,
      variantKey: s(fd, "variant"),
      guestLimit: Number(fd.get("guestLimit")),
      amountMinor: amount,
      affiliateId: s(fd, "affiliateId") || null,
      note: s(fd, "note"),
      idempotencyKey: s(fd, "idem"),
      ipHash: hashIp(await clientIp()),
    });
    if (r.kind === "duplicate") return { ok: false, message: `تم إصدار هذا الطلب مسبقاً (${r.reference}). استخدم «إصدار رمز بديل» من صفحة العملاء.` };
    return done("تم تسجيل البيع وإصدار رمز العميل", { token: r.token, reference: r.reference, phone: s(fd, "customerPhone") });
  } catch (e) {
    return fail(e);
  }
}

export async function reissueCustomerTokenAction(_p: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const { db, ownerId } = await requireOwner();
  try {
    const token = await ownerReissueCustomerToken(db, s(fd, "workspaceId"), ownerId);
    return done("تم إصدار رمز بديل وإلغاء الرمز السابق. سلّمه للعميل بعد التحقق من هويته.", { token });
  } catch (e) {
    return fail(e);
  }
}

export async function guestLimitAction(_p: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const { db, ownerId } = await requireOwner();
  try {
    await setGuestLimit(db, s(fd, "workspaceId"), Number(fd.get("limit")), ownerId);
    return done("تم تحديث عدد المدعوين المسموح");
  } catch (e) {
    return fail(e);
  }
}

export async function extendAccessAction(_p: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const { db, ownerId } = await requireOwner();
  try {
    await extendAccess(db, s(fd, "workspaceId"), Number(fd.get("days")), ownerId);
    return done("تم تمديد مدة الوصول");
  } catch (e) {
    return fail(e);
  }
}

export async function workspaceStatusAction(_p: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const { db, ownerId } = await requireOwner();
  try {
    const st = s(fd, "status") === "suspended" ? "suspended" : "active";
    await setWorkspaceStatus(db, s(fd, "workspaceId"), st, ownerId);
    return done(st === "suspended" ? "تم إيقاف الدعوة" : "تمت إعادة تفعيل الدعوة");
  } catch (e) {
    return fail(e);
  }
}

export async function addNoteAction(_p: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const { db, ownerId } = await requireOwner();
  try {
    const body = s(fd, "body");
    if (!body) throw new UserError("اكتب الملاحظة");
    await db.query(`insert into crm_notes (order_id, author_id, body) values ($1,$2,$3)`, [s(fd, "orderId"), ownerId, body.slice(0, 4000)]);
    const support = s(fd, "support");
    if (["none", "open", "resolved"].includes(support)) await db.query(`update orders set support_status = $2 where id = $1`, [s(fd, "orderId"), support]);
    return done("تمت إضافة الملاحظة");
  } catch (e) {
    return fail(e);
  }
}

export async function refundAction(_p: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const { db, ownerId } = await requireOwner();
  try {
    const cur = s(fd, "currency") || "LYD";
    const amount = parseMajorToMinor(s(fd, "amount"), cur);
    if (amount === null || amount <= 0) throw new UserError("المبلغ غير صحيح");
    const r = await recordRefund(db, {
      orderId: s(fd, "orderId"),
      amountMinor: amount,
      kind: s(fd, "kind") === "chargeback" ? "chargeback" : "refund",
      note: s(fd, "note"),
      ownerId,
      idempotencyKey: s(fd, "idem") || randomId(18),
    });
    return done(r.full ? "تم تسجيل الاسترجاع الكامل وتعديل العمولة" : "تم تسجيل الاسترجاع الجزئي وتعديل العمولة");
  } catch (e) {
    return fail(e);
  }
}

export async function createAffiliateAction(_p: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const { db, ownerId } = await requireOwner();
  try {
    const pct = Number(s(fd, "ratePct").replace(",", "."));
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) throw new UserError("نسبة العمولة غير صحيحة");
    const r = await createAffiliate(
      db,
      { name: s(fd, "name"), phone: s(fd, "phone"), region: s(fd, "region"), referralCode: s(fd, "code"), rateBps: Math.round(pct * 100), canIssueTokens: fd.get("canIssue") === "on" },
      ownerId,
    );
    return done("تم إنشاء حساب المسوق. سلّمه رمز الدخول التالي بطريقة آمنة.", { token: r.token });
  } catch (e) {
    return fail(e);
  }
}

export async function updateAffiliateAction(_p: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const { db, ownerId } = await requireOwner();
  try {
    const pct = Number(s(fd, "ratePct").replace(",", "."));
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) throw new UserError("نسبة العمولة غير صحيحة");
    await updateAffiliate(
      db,
      s(fd, "id"),
      { phone: s(fd, "phone"), region: s(fd, "region"), rateBps: Math.round(pct * 100), canIssueTokens: fd.get("canIssue") === "on", status: s(fd, "status") === "disabled" ? "disabled" : "active", notes: s(fd, "notes") },
      ownerId,
    );
    return done("تم حفظ بيانات المسوق (تغيير النسبة يسري على المبيعات الجديدة فقط)");
  } catch (e) {
    return fail(e);
  }
}

export async function reissueAffiliateTokenAction(_p: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const { db, ownerId } = await requireOwner();
  try {
    const id = s(fd, "id");
    const token = await db.tx(async (q) => {
      const t = await issueAffiliateToken(q, id);
      await audit(q, { actorType: "owner", actorId: ownerId, action: "affiliate.token_reissued", targetType: "affiliate", targetId: id });
      return t;
    });
    return done("تم إصدار رمز جديد للمسوق وإلغاء الرمز السابق", { token });
  } catch (e) {
    return fail(e);
  }
}

export async function approveCommissionsAction(_p: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const { db, ownerId } = await requireOwner();
  try {
    const ids = fd.getAll("ids").map(String);
    const n = await approveCommissions(db, ids, ownerId);
    return done(n ? `تم اعتماد ${n} من العمولات` : "لم يتم تحديد عمولات قيد الانتظار");
  } catch (e) {
    return fail(e);
  }
}

export async function recordPayoutAction(_p: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const { db, ownerId } = await requireOwner();
  try {
    const method = s(fd, "method") as "cash" | "bank_transfer" | "retained_from_cash" | "other";
    if (!["cash", "bank_transfer", "retained_from_cash", "other"].includes(method)) throw new UserError("طريقة الدفع غير صحيحة");
    const r = await recordPayout(db, { affiliateId: s(fd, "affiliateId"), method, reference: s(fd, "reference"), paidOn: s(fd, "paidOn"), note: s(fd, "note"), ownerId });
    return done(`تم تسجيل دفعة بقيمة ${formatMoney(r.amountMinor, r.currency)} — هذا تسجيل لدفعة تمت خارج النظام ولا يحوّل أي أموال.`);
  } catch (e) {
    return fail(e);
  }
}

export async function remittedAction(_p: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const { db, ownerId } = await requireOwner();
  try {
    await markCashRemitted(db, s(fd, "paymentId"), s(fd, "note"), ownerId);
    return done("تم تسجيل استلام النقد من المسوق");
  } catch (e) {
    return fail(e);
  }
}

export async function updateThemeAction(_p: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const { db, ownerId } = await requireOwner();
  try {
    const id = s(fd, "id");
    const cur = s(fd, "currency") || "LYD";
    const price = parseMajorToMinor(s(fd, "price"), cur);
    if (price === null) throw new UserError("السعر غير صحيح");
    const status = s(fd, "status");
    if (!["draft", "active", "disabled"].includes(status)) throw new UserError("الحالة غير صحيحة");
    await db.tx(async (q) => {
      await q.query(`update themes set price_minor = $2, status = $3, featured = $4, name_ar = coalesce(nullif($5,''), name_ar), description_ar = $6, updated_at = now() where id = $1`, [
        id, price, status, fd.get("featured") === "on", s(fd, "name").slice(0, 80), s(fd, "description").slice(0, 600),
      ]);
      const variantIds = fd.getAll("variantIds").map(String);
      const enabled = new Set(fd.getAll("enabled").map(String));
      for (const vid of variantIds) {
        await q.query(`update theme_color_variants set status = $2 where id = $1`, [vid, enabled.has(vid) ? "active" : "disabled"]);
      }
      await audit(q, { actorType: "owner", actorId: ownerId, action: "theme.updated", targetType: "theme", targetId: id, details: { price, status } });
    });
    return done("تم حفظ التصميم (الطلبات السابقة تحتفظ بسعرها وإصدارها)");
  } catch (e) {
    return fail(e);
  }
}

export async function saveSettingsAction(_p: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const { db, ownerId } = await requireOwner();
  try {
    const int = (k: string, min: number, max: number) => {
      const v = Math.trunc(Number(fd.get(k)));
      if (!Number.isFinite(v) || v < min || v > max) throw new UserError("قيمة غير صحيحة في الإعدادات");
      return v;
    };
    const pct = Number(s(fd, "commissionPct").replace(",", "."));
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) throw new UserError("نسبة العمولة غير صحيحة");
    const patch: Partial<Settings> = {
      defaultCommissionBps: Math.round(pct * 100),
      defaultGuestLimit: int("defaultGuestLimit", 1, 5000),
      guestLinkDays: int("guestLinkDays", 1, 365),
      customerAccessDays: int("customerAccessDays", 7, 3650),
      maxGuestsPerInvitation: int("maxGuestsPerInvitation", 1, 5000),
      maxPhotos: int("maxPhotos", 0, 20),
      maxUploadMb: int("maxUploadMb", 1, 20),
      allowMusic: fd.get("allowMusic") === "on",
      allowPartySize: fd.get("allowPartySize") === "on",
      suspendOnFullRefund: fd.get("suspendOnFullRefund") === "on",
      contactWhatsapp: s(fd, "contactWhatsapp").replace(/[^\d+]/g, "").slice(0, 20),
      orderInstructions: s(fd, "orderInstructions").slice(0, 400),
    };
    await saveSettings(db, patch);
    await audit(db, { actorType: "owner", actorId: ownerId, action: "settings.updated", details: patch as Record<string, unknown> });
    return done("تم حفظ الإعدادات");
  } catch (e) {
    return fail(e);
  }
}

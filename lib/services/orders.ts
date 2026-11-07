import "server-only";
import type { Db, Queryable } from "@/lib/db";
import { num } from "@/lib/db";
import { newOrderReference, newSecret, normalizeSecret, hashSecret } from "@/lib/security/tokens";
import { audit } from "@/lib/security/audit";
import { revokeSubjectSessions } from "@/lib/security/sessions";
import { commissionFor } from "@/lib/money";
import { defaultContent, defaultPages, defaultSettings } from "@/lib/invitation/defaults";
import { getThemeBySlug } from "./catalog";
import { getSettings } from "./settings";
import { UserError } from "./errors";

/*
 * SALES MODEL (payment happens person-to-person, never on the website)
 *
 *   buyer pays cash to the owner or to a representative
 *        │
 *        ▼
 *   issueCustomerAccess()  ← only from the OWNER dashboard, or an AFFILIATE dashboard when the
 *        │                   owner has granted that affiliate "can_issue_tokens"
 *        ├─ sale record (theme/version/colour, guest limit, amount actually received)
 *        ├─ payment record (who holds the cash; affiliate cash is tracked until handed over)
 *        ├─ customer workspace + invitation (guest_limit = how many people they may invite)
 *        ├─ 15% commission (pending) when a representative sold it
 *        └─ customer dashboard token (shown ONCE to the issuer to hand to the customer)
 *
 * All of it happens in one transaction guarded by an idempotency key (a double-tap on
 * "issue" can never create two customers, two payments or two commissions).
 */

export type OrderStatus = "paid" | "cancelled" | "refunded" | "partially_refunded";

export const ORDER_STATUS_AR: Record<OrderStatus, string> = {
  paid: "مدفوع",
  cancelled: "ملغى",
  refunded: "مسترجع بالكامل",
  partially_refunded: "مسترجع جزئياً",
};

export function normalizeReferralCode(s: string): string {
  return (s || "").normalize("NFKC").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function normalizeOrderReference(s: string): string | null {
  const c = (s || "").normalize("NFKC").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  const body = c.startsWith("DW") ? c.slice(2) : c;
  if (!/^[A-HJ-NP-Z2-9]{8}$/.test(body)) return null;
  return `DW-${body.slice(0, 4)}-${body.slice(4)}`;
}

export function phoneProblem(p: string): string | null {
  if (!p) return null;
  return /^\+?[0-9\s-]{7,20}$/.test(p) ? null : "رقم الهاتف غير صحيح";
}

export type Issuer = { type: "owner"; id: string } | { type: "affiliate"; id: string };

export interface IssueInput {
  issuer: Issuer;
  customerName: string;
  customerPhone?: string;
  themeSlug: string;
  variantKey: string;
  guestLimit: number;
  amountMinor?: number; // defaults to the theme's list price
  affiliateId?: string | null; // owner may credit a representative
  note?: string;
  idempotencyKey: string;
  ipHash?: string;
}

export type IssueResult =
  | { kind: "issued"; reference: string; token: string; workspaceId: string; orderId: string }
  | { kind: "duplicate"; reference: string };

export async function issueCustomerAccess(db: Db, input: IssueInput): Promise<IssueResult> {
  const name = (input.customerName || "").normalize("NFKC").trim().slice(0, 120);
  if (!name) throw new UserError("اسم العميل مطلوب");
  const phone = (input.customerPhone || "").trim().slice(0, 30);
  const pErr = phoneProblem(phone);
  if (pErr) throw new UserError(pErr);
  const limit = Math.trunc(Number(input.guestLimit));
  if (!Number.isInteger(limit) || limit < 1 || limit > 5000) throw new UserError("عدد المدعوين يجب أن يكون بين 1 و 5000");
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(input.idempotencyKey || "")) throw new UserError("انتهت صلاحية النموذج، أعد تحميل الصفحة");

  return db.tx(async (q) => {
    const dup = await q.query<{ reference: string }>(`select reference from orders where idempotency_key = $1`, [input.idempotencyKey]);
    if (dup.rows[0]) return { kind: "duplicate" as const, reference: dup.rows[0].reference };

    const theme = await getThemeBySlug(q, input.themeSlug);
    if (!theme) throw new UserError("هذا التصميم غير متاح حالياً");
    const variant = theme.variants.find((v) => v.key === input.variantKey && v.status === "active");
    if (!variant) throw new UserError("اللون المختار غير متاح لهذا التصميم");
    const amount = input.amountMinor ?? theme.priceMinor;
    if (!Number.isInteger(amount) || amount <= 0) throw new UserError("المبلغ المستلم غير صحيح");
    const settings = await getSettings(q);

    let affiliateId: string | null = null;
    let source: "issued_by_affiliate" | "assigned_by_owner" | null = null;
    let rate: number | null = null;
    if (input.issuer.type === "affiliate") {
      const a = await q.query<{ status: string; can_issue_tokens: boolean; commission_rate_bps: number }>(
        `select status, can_issue_tokens, commission_rate_bps from affiliates where id = $1`,
        [input.issuer.id],
      );
      const aff = a.rows[0];
      if (!aff || aff.status !== "active" || !aff.can_issue_tokens) throw new UserError("غير مصرح لك بإصدار رموز للعملاء", "forbidden");
      affiliateId = input.issuer.id;
      source = "issued_by_affiliate";
      rate = num(aff.commission_rate_bps);
    } else if (input.affiliateId) {
      const a = await q.query<{ commission_rate_bps: number }>(`select commission_rate_bps from affiliates where id = $1 and status = 'active'`, [input.affiliateId]);
      if (!a.rows[0]) throw new UserError("المسوق المختار غير موجود أو موقوف");
      affiliateId = input.affiliateId;
      source = "assigned_by_owner";
      rate = num(a.rows[0].commission_rate_bps);
    }

    let reference = "";
    let orderId = "";
    for (let i = 0; i < 6 && !orderId; i++) {
      reference = newOrderReference();
      const r = await q.query<{ id: string }>(
        `insert into orders (reference, idempotency_key, theme_id, theme_version_id, color_variant_key, guest_limit,
                             list_price_minor, amount_minor, currency, customer_name, customer_phone, affiliate_id,
                             attribution_source, commission_rate_bps, issued_by_type, issued_by_id, note)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
         on conflict (reference) do nothing returning id`,
        [reference, input.idempotencyKey, theme.id, theme.versionId, variant.key, limit, theme.priceMinor, amount, theme.currency,
         name, phone, affiliateId, source, rate, input.issuer.type, input.issuer.id, (input.note || "").slice(0, 500)],
      );
      orderId = r.rows[0]?.id ?? "";
    }
    if (!orderId) throw new Error("could not allocate a reference");

    await q.query(
      `insert into payments (order_id, provider, idempotency_key, amount_minor, currency, received_by_type, received_by_id)
       values ($1,'cash',$2,$3,$4,$5,$6)`,
      [orderId, `sale:${orderId}`, amount, theme.currency, input.issuer.type, input.issuer.id],
    );

    const ws = await q.query<{ id: string }>(
      `insert into customer_workspaces (order_id, access_expires_at, recovery_phone)
       values ($1, now() + make_interval(days => $2::int), $3) returning id`,
      [orderId, settings.customerAccessDays, phone],
    );
    const workspaceId = ws.rows[0].id;
    await q.query(
      `insert into invitations (workspace_id, theme_version_id, color_variant_key, guest_limit, content, pages, settings)
       values ($1,$2,$3,$4,$5,$6,$7)`,
      [workspaceId, theme.versionId, variant.key, limit, JSON.stringify(defaultContent()), JSON.stringify(defaultPages()), JSON.stringify(defaultSettings())],
    );

    if (affiliateId && rate !== null) {
      const basis = amount - commissionFor(amount, settings.commissionExcludeFeesBps);
      await q.query(
        `insert into commission_records (affiliate_id, order_id, kind, basis_minor, rate_bps, amount_minor, currency, status, reason)
         values ($1,$2,'sale',$3,$4,$5,$6,'pending','sale')`,
        [affiliateId, orderId, basis, rate, commissionFor(basis, rate), theme.currency],
      );
    }

    const token = await issueCustomerToken(q, workspaceId, "purchase");
    await audit(q, {
      actorType: input.issuer.type,
      actorId: input.issuer.id,
      action: "sale.issued",
      targetType: "order",
      targetId: orderId,
      details: { reference, amount, guestLimit: limit, affiliateId },
      ipHash: input.ipHash,
    });
    return { kind: "issued" as const, reference, token, workspaceId, orderId };
  });
}

/** Issues a NEW customer dashboard token, revoking every previous token and session of the workspace. */
export async function issueCustomerToken(q: Queryable, workspaceId: string, reason: "purchase" | "rotation" | "owner_reissue" | "recovery"): Promise<string> {
  await q.query(`update customer_credentials set revoked_at = now() where workspace_id = $1 and revoked_at is null`, [workspaceId]);
  await revokeSubjectSessions(q, "customer", workspaceId);
  const s = newSecret("customer");
  await q.query(`insert into customer_credentials (workspace_id, token_hash, token_hint, reason) values ($1,$2,$3,$4)`, [workspaceId, s.hash, s.hint, reason]);
  return s.raw;
}

/** Customer dashboard token → workspace (for session creation). */
export async function resolveCustomerToken(db: Db, raw: string): Promise<{ workspaceId: string } | { error: string }> {
  const norm = normalizeSecret(raw, "customer");
  if (!norm) return { error: "رمز الدخول غير صحيح" };
  const r = await db.query<{ workspace_id: string; ws_status: string; expired: boolean; cred_id: string }>(
    `select c.id as cred_id, c.workspace_id, w.status as ws_status, w.access_expires_at <= now() as expired
       from customer_credentials c join customer_workspaces w on w.id = c.workspace_id
      where c.token_hash = $1 and c.revoked_at is null`,
    [hashSecret(norm)],
  );
  const row = r.rows[0];
  if (!row) return { error: "رمز الدخول غير صحيح أو تم إلغاؤه" };
  if (row.ws_status !== "active") return { error: "تم إيقاف هذه الدعوة مؤقتاً، يرجى التواصل معنا" };
  if (row.expired) return { error: "انتهت مدة الوصول إلى هذه الدعوة، يرجى التواصل معنا" };
  await db.query(`update customer_credentials set last_used_at = now() where id = $1`, [row.cred_id]);
  return { workspaceId: row.workspace_id };
}

/** Lost token: the owner verifies the customer (name, phone, reference) and issues a replacement. */
export async function ownerReissueCustomerToken(db: Db, workspaceId: string, ownerId: string): Promise<string> {
  return db.tx(async (q) => {
    const w = await q.query<{ id: string }>(`select id from customer_workspaces where id = $1`, [workspaceId]);
    if (!w.rows[0]) throw new UserError("العميل غير موجود", "not_found");
    const t = await issueCustomerToken(q, workspaceId, "owner_reissue");
    await audit(q, { actorType: "owner", actorId: ownerId, action: "credential.owner_reissued", targetType: "workspace", targetId: workspaceId });
    return t;
  });
}

export async function setGuestLimit(db: Db, workspaceId: string, limit: number, ownerId: string): Promise<void> {
  if (!Number.isInteger(limit) || limit < 1 || limit > 5000) throw new UserError("عدد المدعوين يجب أن يكون بين 1 و 5000");
  await db.tx(async (q) => {
    const cur = await q.query<{ c: number }>(
      `select count(*)::int as c from guests g join invitations i on i.id = g.invitation_id where i.workspace_id = $1 and g.deleted_at is null`,
      [workspaceId],
    );
    if (num(cur.rows[0].c) > limit) throw new UserError("العدد الجديد أقل من عدد المدعوين الحاليين");
    await q.query(`update invitations set guest_limit = $2 where workspace_id = $1`, [workspaceId, limit]);
    await q.query(`update orders set guest_limit = $2 where id = (select order_id from customer_workspaces where id = $1)`, [workspaceId, limit]);
    await audit(q, { actorType: "owner", actorId: ownerId, action: "workspace.guest_limit", targetType: "workspace", targetId: workspaceId, details: { limit } });
  });
}

export async function setWorkspaceStatus(db: Db, workspaceId: string, status: "active" | "suspended", ownerId: string) {
  await db.tx(async (q) => {
    const r = await q.query(`update customer_workspaces set status = $2, updated_at = now() where id = $1`, [workspaceId, status]);
    if (r.rowCount === 0) throw new UserError("العميل غير موجود", "not_found");
    await q.query(`update invitations set status = $2 where workspace_id = $1`, [workspaceId, status]);
    if (status === "suspended") await revokeSubjectSessions(q, "customer", workspaceId);
    await audit(q, { actorType: "owner", actorId: ownerId, action: `workspace.${status}`, targetType: "workspace", targetId: workspaceId });
  });
}

export async function extendAccess(db: Db, workspaceId: string, days: number, ownerId: string) {
  if (!Number.isInteger(days) || days < 1 || days > 3650) throw new UserError("عدد الأيام غير صحيح");
  await db.tx(async (q) => {
    await q.query(
      `update customer_workspaces set access_expires_at = greatest(access_expires_at, now()) + make_interval(days => $2::int), updated_at = now() where id = $1`,
      [workspaceId, days],
    );
    await audit(q, { actorType: "owner", actorId: ownerId, action: "workspace.extended", targetType: "workspace", targetId: workspaceId, details: { days } });
  });
}

/**
 * Records a full or partial refund / chargeback. Financial history is preserved:
 *  - unpaid sale commission + full refund → the sale commission is REVERSED
 *  - otherwise a negative ADJUSTMENT is added (proportional to the refunded share). If the sale
 *    commission was already paid out, the adjustment is a claw-back netted against the next payout.
 */
export async function recordRefund(
  db: Db,
  input: { orderId: string; amountMinor: number; kind: "refund" | "chargeback"; note: string; ownerId: string; idempotencyKey: string },
): Promise<{ refundId: string; full: boolean }> {
  if (!Number.isInteger(input.amountMinor) || input.amountMinor <= 0) throw new UserError("المبلغ غير صحيح");
  return db.tx(async (q) => {
    const or = await q.query<{ id: string; status: string }>(`select id, status from orders where id = $1 for update`, [input.orderId]);
    const order = or.rows[0];
    if (!order) throw new UserError("الطلب غير موجود", "not_found");
    const existing = await q.query<{ id: string }>(`select id from refunds where idempotency_key = $1`, [input.idempotencyKey]);
    if (existing.rows[0]) return { refundId: existing.rows[0].id, full: order.status === "refunded" };
    const pr = await q.query<{ id: string; amount_minor: number }>(`select id, amount_minor from payments where order_id = $1`, [order.id]);
    const payment = pr.rows[0];
    if (!payment) throw new UserError("لا توجد دفعة مسجلة لهذا الطلب");
    const paid = num(payment.amount_minor);
    const prev = num((await q.query<{ s: number }>(`select coalesce(sum(amount_minor),0)::bigint as s from refunds where order_id = $1`, [order.id])).rows[0].s);
    if (prev + input.amountMinor > paid) throw new UserError("مبلغ الاسترجاع أكبر من المبلغ المدفوع المتبقي");
    const ins = await q.query<{ id: string }>(
      `insert into refunds (order_id, payment_id, kind, amount_minor, note, idempotency_key, created_by) values ($1,$2,$3,$4,$5,$6,$7) returning id`,
      [order.id, payment.id, input.kind, input.amountMinor, input.note.slice(0, 500), input.idempotencyKey, input.ownerId],
    );
    const refundId = ins.rows[0].id;
    const full = prev + input.amountMinor >= paid;
    await q.query(`update orders set status = $2 where id = $1`, [order.id, full ? "refunded" : "partially_refunded"]);

    const sr = await q.query<Record<string, unknown>>(`select * from commission_records where order_id = $1 and kind = 'sale' for update`, [order.id]);
    const sale = sr.rows[0];
    if (sale && sale.status !== "reversed") {
      if (full && sale.status !== "paid") {
        await q.query(`update commission_records set status = 'reversed', reversed_at = now(), reason = $2 where order_id = $1 and status in ('pending','approved')`, [order.id, input.kind]);
      } else {
        const basis = num(sale.basis_minor);
        const refundBasis = Math.round((basis * input.amountMinor) / paid);
        const rate = num(sale.rate_bps);
        const net = num((await q.query<{ s: number }>(`select coalesce(sum(amount_minor),0)::bigint as s from commission_records where order_id = $1 and status <> 'reversed'`, [order.id])).rows[0].s);
        let amount = full ? -net : commissionFor(-refundBasis, rate);
        amount = Math.max(amount, -net); // never claw back more than was credited
        if (amount < 0) {
          await q.query(
            `insert into commission_records (affiliate_id, order_id, kind, basis_minor, rate_bps, amount_minor, currency, status, reason, refund_id)
             values ($1,$2,'adjustment',$3,$4,$5,$6,$7,$8,$9)`,
            [sale.affiliate_id, order.id, -refundBasis, rate, amount, sale.currency, sale.status === "paid" ? "approved" : sale.status, input.kind, refundId],
          );
        }
      }
    }
    const settings = await getSettings(q);
    if (full && settings.suspendOnFullRefund) {
      const w = await q.query<{ id: string }>(`update customer_workspaces set status = 'suspended', updated_at = now() where order_id = $1 returning id`, [order.id]);
      if (w.rows[0]) {
        await q.query(`update invitations set status = 'suspended' where workspace_id = $1`, [w.rows[0].id]);
        await revokeSubjectSessions(q, "customer", w.rows[0].id);
      }
    }
    await audit(q, { actorType: "owner", actorId: input.ownerId, action: `order.${input.kind}`, targetType: "order", targetId: order.id, details: { amount: input.amountMinor, full } });
    return { refundId, full };
  });
}

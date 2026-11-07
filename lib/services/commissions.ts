import "server-only";
import type { Db, Queryable } from "@/lib/db";
import { num } from "@/lib/db";
import { audit } from "@/lib/security/audit";
import { UserError } from "./errors";

export const COMMISSION_STATUS_AR: Record<string, string> = { pending: "قيد الانتظار", approved: "معتمدة", paid: "مدفوعة", reversed: "ملغاة" };
export const PAYOUT_METHOD_AR: Record<string, string> = {
  cash: "نقداً",
  bank_transfer: "تحويل مصرفي",
  retained_from_cash: "خُصمت من النقد المحصّل",
  other: "أخرى",
};

export async function listCommissions(q: Queryable, filter: { affiliateId?: string; status?: string } = {}) {
  const r = await q.query<Record<string, unknown>>(
    `select c.*, a.name as affiliate_name, a.referral_code, o.reference
       from commission_records c join affiliates a on a.id = c.affiliate_id join orders o on o.id = c.order_id
      where ($1::uuid is null or c.affiliate_id = $1) and ($2::text is null or c.status = $2)
      order by c.created_at desc limit 500`,
    [filter.affiliateId ?? null, filter.status ?? null],
  );
  return r.rows.map((x) => ({
    id: x.id as string,
    affiliateId: x.affiliate_id as string,
    affiliateName: x.affiliate_name as string,
    referralCode: x.referral_code as string,
    reference: x.reference as string,
    kind: x.kind as string,
    basisMinor: num(x.basis_minor),
    rateBps: num(x.rate_bps),
    amountMinor: num(x.amount_minor),
    currency: x.currency as string,
    status: x.status as string,
    reason: x.reason as string,
    createdAt: new Date(x.created_at as string).toISOString(),
  }));
}

export async function approveCommissions(db: Db, ids: string[], ownerId: string): Promise<number> {
  const valid = ids.filter((i) => /^[0-9a-f-]{36}$/i.test(i));
  if (valid.length === 0) return 0;
  return db.tx(async (q) => {
    const r = await q.query(`update commission_records set status = 'approved', approved_at = now() where id = any($1::uuid[]) and status = 'pending'`, [valid]);
    await audit(q, { actorType: "owner", actorId: ownerId, action: "commission.approved", details: { count: r.rowCount, ids: valid } });
    return r.rowCount;
  });
}

/**
 * Records a payout that the owner ALREADY made outside the system (cash, bank transfer, or kept
 * by the rep from collected cash). It settles every approved record of that affiliate, including
 * negative claw-back adjustments; the total must be positive.
 */
export async function recordPayout(
  db: Db,
  input: { affiliateId: string; method: "cash" | "bank_transfer" | "retained_from_cash" | "other"; reference: string; paidOn: string; note: string; ownerId: string },
): Promise<{ payoutId: string; amountMinor: number; currency: string }> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.paidOn)) throw new UserError("تاريخ الدفع غير صحيح");
  if (!input.reference.trim()) throw new UserError("أدخل مرجع الدفع (رقم الإيصال أو وصف التسليم)");
  return db.tx(async (q) => {
    const recs = await q.query<{ id: string; amount_minor: number; currency: string }>(
      `select id, amount_minor, currency from commission_records where affiliate_id = $1 and status = 'approved' and payout_id is null for update`,
      [input.affiliateId],
    );
    if (recs.rows.length === 0) throw new UserError("لا توجد عمولات معتمدة غير مدفوعة لهذا المسوق");
    const currencies = new Set(recs.rows.map((r) => r.currency));
    if (currencies.size > 1) throw new UserError("لا يمكن دمج عملات مختلفة في دفعة واحدة");
    const total = recs.rows.reduce((s, r) => s + num(r.amount_minor), 0);
    if (total <= 0) throw new UserError("صافي العمولات المعتمدة ليس موجباً (توجد تسويات سالبة)");
    const p = await q.query<{ id: string }>(
      `insert into commission_payouts (affiliate_id, amount_minor, currency, method, reference, paid_on, note, created_by)
       values ($1,$2,$3,$4,$5,$6,$7,$8) returning id`,
      [input.affiliateId, total, [...currencies][0], input.method, input.reference.trim().slice(0, 200), input.paidOn, input.note.slice(0, 500), input.ownerId],
    );
    await q.query(`update commission_records set status = 'paid', paid_at = now(), payout_id = $2 where id = any($1::uuid[])`, [recs.rows.map((r) => r.id), p.rows[0].id]);
    await audit(q, { actorType: "owner", actorId: input.ownerId, action: "payout.recorded", targetType: "affiliate", targetId: input.affiliateId, details: { amount: total, method: input.method, reference: input.reference } });
    return { payoutId: p.rows[0].id, amountMinor: total, currency: [...currencies][0] };
  });
}

/** Cash collected by an affiliate and later handed over to the owner. */
export async function markCashRemitted(db: Db, paymentId: string, note: string, ownerId: string) {
  await db.tx(async (q) => {
    const r = await q.query(`update payments set remitted_at = now(), remitted_note = $2 where id = $1 and received_by_type = 'affiliate' and remitted_at is null`, [paymentId, note.slice(0, 300)]);
    if (r.rowCount === 0) throw new UserError("لا يمكن تحديث هذه الدفعة");
    await audit(q, { actorType: "owner", actorId: ownerId, action: "payment.cash_remitted", targetType: "payment", targetId: paymentId });
  });
}

import "server-only";
import type { Db, Queryable } from "@/lib/db";
import { num } from "@/lib/db";
import { newSecret, normalizeSecret, hashSecret } from "@/lib/security/tokens";
import { audit } from "@/lib/security/audit";
import { revokeSubjectSessions } from "@/lib/security/sessions";
import { getSettings } from "./settings";
import { normalizeReferralCode, ORDER_STATUS_AR, type OrderStatus } from "./orders";
import { UserError } from "./errors";

export interface AffiliateRow {
  id: string;
  name: string;
  phone: string;
  region: string;
  referralCode: string;
  rateBps: number;
  canIssueTokens: boolean;
  status: string;
  notes: string;
  createdAt: string;
}

function mapAff(x: Record<string, unknown>): AffiliateRow {
  return {
    id: x.id as string,
    name: x.name as string,
    phone: (x.phone as string) || "",
    region: (x.region as string) || "",
    referralCode: x.referral_code as string,
    rateBps: num(x.commission_rate_bps),
    canIssueTokens: !!x.can_issue_tokens,
    status: x.status as string,
    notes: (x.notes as string) || "",
    createdAt: new Date(x.created_at as string).toISOString(),
  };
}

export async function getAffiliate(q: Queryable, id: string): Promise<AffiliateRow | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const r = await q.query<Record<string, unknown>>(`select * from affiliates where id = $1`, [id]);
  return r.rows[0] ? mapAff(r.rows[0]) : null;
}

export async function createAffiliate(
  db: Db,
  input: { name: string; phone?: string; region?: string; referralCode: string; rateBps?: number; canIssueTokens?: boolean },
  ownerId: string,
): Promise<{ affiliateId: string; token: string }> {
  const name = input.name.trim().slice(0, 120);
  if (!name) throw new UserError("اسم المسوق مطلوب");
  const code = normalizeReferralCode(input.referralCode);
  if (!/^[A-Z0-9]{4,20}$/.test(code)) throw new UserError("رمز الإحالة يجب أن يكون من 4 إلى 20 حرفاً لاتينياً أو رقماً");
  return db.tx(async (q) => {
    const s = await getSettings(q);
    const rate = input.rateBps ?? s.defaultCommissionBps;
    if (!Number.isInteger(rate) || rate < 0 || rate > 10000) throw new UserError("نسبة العمولة غير صحيحة");
    const ins = await q.query<{ id: string }>(
      `insert into affiliates (name, phone, region, referral_code, commission_rate_bps, can_issue_tokens)
       values ($1,$2,$3,$4,$5,$6) on conflict (referral_code) do nothing returning id`,
      [name, (input.phone || "").trim(), (input.region || "").trim(), code, rate, !!input.canIssueTokens],
    );
    if (!ins.rows[0]) throw new UserError("رمز الإحالة مستخدم من قبل");
    const id = ins.rows[0].id;
    await q.query(`insert into affiliate_rate_history (affiliate_id, rate_bps, changed_by) values ($1,$2,$3)`, [id, rate, ownerId]);
    const token = await issueAffiliateToken(q, id);
    await audit(q, { actorType: "owner", actorId: ownerId, action: "affiliate.created", targetType: "affiliate", targetId: id, details: { code, rate } });
    return { affiliateId: id, token };
  });
}

/** Changing the rate affects FUTURE orders only; existing orders and commissions keep their snapshot. */
export async function updateAffiliate(
  db: Db,
  id: string,
  patch: { name?: string; phone?: string; region?: string; rateBps?: number; canIssueTokens?: boolean; status?: "active" | "disabled"; notes?: string },
  ownerId: string,
) {
  await db.tx(async (q) => {
    const a = await getAffiliate(q, id);
    if (!a) throw new UserError("المسوق غير موجود", "not_found");
    if (patch.rateBps !== undefined && (!Number.isInteger(patch.rateBps) || patch.rateBps < 0 || patch.rateBps > 10000)) throw new UserError("نسبة العمولة غير صحيحة");
    await q.query(
      `update affiliates set name = coalesce($2, name), phone = coalesce($3, phone), region = coalesce($4, region),
              commission_rate_bps = coalesce($5, commission_rate_bps), can_issue_tokens = coalesce($6, can_issue_tokens),
              status = coalesce($7, status), notes = coalesce($8, notes), updated_at = now()
        where id = $1`,
      [id, patch.name?.trim() || null, patch.phone ?? null, patch.region ?? null, patch.rateBps ?? null, patch.canIssueTokens ?? null, patch.status ?? null, patch.notes ?? null],
    );
    if (patch.rateBps !== undefined && patch.rateBps !== a.rateBps) {
      await q.query(`insert into affiliate_rate_history (affiliate_id, rate_bps, changed_by) values ($1,$2,$3)`, [id, patch.rateBps, ownerId]);
    }
    if (patch.status === "disabled") {
      await q.query(`update affiliate_credentials set revoked_at = now() where affiliate_id = $1 and revoked_at is null`, [id]);
      await revokeSubjectSessions(q, "affiliate", id);
    }
    await audit(q, { actorType: "owner", actorId: ownerId, action: "affiliate.updated", targetType: "affiliate", targetId: id, details: patch as Record<string, unknown> });
  });
}

export async function issueAffiliateToken(q: Queryable, affiliateId: string): Promise<string> {
  await q.query(`update affiliate_credentials set revoked_at = now() where affiliate_id = $1 and revoked_at is null`, [affiliateId]);
  await revokeSubjectSessions(q, "affiliate", affiliateId);
  const s = newSecret("affiliate");
  await q.query(`insert into affiliate_credentials (affiliate_id, token_hash, token_hint) values ($1,$2,$3)`, [affiliateId, s.hash, s.hint]);
  return s.raw;
}

export async function resolveAffiliateToken(db: Db, raw: string): Promise<{ affiliateId: string } | { error: string }> {
  const norm = normalizeSecret(raw, "affiliate");
  if (!norm) return { error: "رمز الدخول غير صحيح" };
  const r = await db.query<{ id: string; affiliate_id: string; status: string }>(
    `select c.id, c.affiliate_id, a.status from affiliate_credentials c join affiliates a on a.id = c.affiliate_id
      where c.token_hash = $1 and c.revoked_at is null`,
    [hashSecret(norm)],
  );
  const row = r.rows[0];
  if (!row) return { error: "رمز الدخول غير صحيح أو تم إلغاؤه" };
  if (row.status !== "active") return { error: "تم إيقاف هذا الحساب، يرجى التواصل مع الإدارة" };
  await db.query(`update affiliate_credentials set last_used_at = now() where id = $1`, [row.id]);
  return { affiliateId: row.affiliate_id };
}

/** Referral link visit (?ref=CODE). Returns true if the code was valid. */
export async function recordReferralVisit(db: Db, codeIn: string, visitorHash: string, path: string): Promise<boolean> {
  const code = normalizeReferralCode(codeIn);
  if (!/^[A-Z0-9]{4,20}$/.test(code)) return false;
  return db.tx(async (q) => {
    const a = await q.query<{ id: string }>(`select id from affiliates where referral_code = $1 and status = 'active'`, [code]);
    if (!a.rows[0]) return false;
    await q.query(`insert into referral_visits (affiliate_id, visitor_hash, landing_path) values ($1,$2,$3)`, [a.rows[0].id, visitorHash, path.slice(0, 200)]);
    return true;
  });
}

// ------------------------------------------------------------------ affiliate dashboard (scoped to ONE affiliate)

export async function affiliateSummary(q: Queryable, affiliateId: string) {
  const r = await q.query<Record<string, unknown>>(
    `select
       (select count(*)::int from orders where affiliate_id = $1 and status in ('paid','partially_refunded','refunded')) as paid_orders,
       (select count(distinct visitor_hash)::int from referral_visits where affiliate_id = $1) as visitors,
       (select count(*)::int from referral_visits where affiliate_id = $1) as visits,
       coalesce((select sum(basis_minor) from commission_records where affiliate_id = $1 and status <> 'reversed'), 0)::bigint as eligible,
       coalesce((select sum(amount_minor) from commission_records where affiliate_id = $1 and status = 'pending'), 0)::bigint as pending,
       coalesce((select sum(amount_minor) from commission_records where affiliate_id = $1 and status = 'approved'), 0)::bigint as approved,
       coalesce((select sum(amount_minor) from commission_records where affiliate_id = $1 and status = 'paid'), 0)::bigint as paid,
       coalesce((select sum(amount_minor) from commission_records where affiliate_id = $1 and status = 'reversed'), 0)::bigint as reversed`,
    [affiliateId],
  );
  const x = r.rows[0];
  return {
    paidOrders: num(x.paid_orders),
    visitors: num(x.visitors),
    visits: num(x.visits),
    eligibleMinor: num(x.eligible),
    pendingMinor: num(x.pending),
    approvedMinor: num(x.approved),
    paidMinor: num(x.paid),
    reversedMinor: num(x.reversed),
  };
}

/** Minimal order info only: no customer names, phones, workspace ids, tokens or guest data. */
export async function affiliateOrders(q: Queryable, affiliateId: string, limit = 100) {
  const r = await q.query<Record<string, unknown>>(
    `select o.reference, o.status, o.created_at, o.paid_at, o.amount_minor, o.currency, o.attribution_source, o.guest_limit,
            t.name_ar as theme_name,
            coalesce((select sum(amount_minor) from commission_records c where c.order_id = o.id and c.affiliate_id = $1 and c.status <> 'reversed'), 0)::bigint as commission,
            (select status from commission_records c where c.order_id = o.id and c.kind = 'sale' and c.affiliate_id = $1) as commission_status
       from orders o join themes t on t.id = o.theme_id
      where o.affiliate_id = $1
      order by o.created_at desc limit $2`,
    [affiliateId, limit],
  );
  return r.rows.map((x) => {
    const st = x.status as OrderStatus;
    return {
      reference: x.reference as string,
      status: st,
      statusAr: ORDER_STATUS_AR[st],
      createdAt: new Date(x.created_at as string).toISOString(),
      paidAt: x.paid_at ? new Date(x.paid_at as string).toISOString() : null,
      guestLimit: num(x.guest_limit),
      amountMinor: num(x.amount_minor),
      currency: x.currency as string,
      themeName: x.theme_name as string,
      source: x.attribution_source as string,
      commissionMinor: num(x.commission),
      commissionStatus: (x.commission_status as string) ?? null,
    };
  });
}

export async function affiliatePayouts(q: Queryable, affiliateId: string) {
  const r = await q.query<Record<string, unknown>>(
    `select id, amount_minor, currency, method, reference, paid_on, note, created_at from commission_payouts where affiliate_id = $1 order by paid_on desc, created_at desc`,
    [affiliateId],
  );
  return r.rows.map((x) => ({
    id: x.id as string,
    amountMinor: num(x.amount_minor),
    currency: x.currency as string,
    method: x.method as string,
    reference: x.reference as string,
    paidOn: String(x.paid_on instanceof Date ? (x.paid_on as Date).toISOString().slice(0, 10) : x.paid_on),
    note: x.note as string,
  }));
}

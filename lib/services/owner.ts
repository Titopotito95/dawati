import "server-only";
import type { Db, Queryable } from "@/lib/db";
import { num } from "@/lib/db";
import { hashPassword, verifyPassword, passwordProblem, dummyHash } from "@/lib/security/password";
import { newTotpSecret, verifyTotp, otpauthUrl } from "@/lib/security/totp";
import { encrypt, decrypt, safeEqual } from "@/lib/security/crypto";
import { rateLimit } from "@/lib/security/rateLimit";
import { audit } from "@/lib/security/audit";
import { UserError } from "./errors";

/*
 * Owner authentication: username + scrypt password + mandatory TOTP (MFA). There is no public
 * signup. The first owner is created either with `npm run owner:create` or via /owner/setup,
 * which requires the OWNER_SETUP_TOKEN environment secret and is disabled once an owner exists.
 */

export async function ownerExists(q: Queryable): Promise<boolean> {
  return num((await q.query<{ c: number }>(`select count(*)::int as c from admin_users where totp_enabled`)).rows[0].c) > 0;
}

export function checkSetupToken(input: string): boolean {
  const t = process.env.OWNER_SETUP_TOKEN || "";
  return t.length >= 16 && safeEqual(input.trim(), t);
}

/** Step 1: create (or replace a not-yet-activated) owner and return the TOTP enrolment secret. */
export async function beginOwnerSetup(db: Db, username: string, password: string): Promise<{ ownerId: string; secret: string; otpauth: string }> {
  const u = username.trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,40}$/.test(u)) throw new UserError("اسم المستخدم يجب أن يكون من 3 إلى 40 حرفاً لاتينياً أو أرقام");
  const pErr = passwordProblem(password);
  if (pErr) throw new UserError(pErr);
  return db.tx(async (q) => {
    if (await ownerExists(q)) throw new UserError("تم إعداد حساب المالك مسبقاً", "forbidden");
    const secret = newTotpSecret();
    const hash = await hashPassword(password);
    await q.query(`delete from admin_users where not totp_enabled`);
    const r = await q.query<{ id: string }>(
      `insert into admin_users (username, password_hash, totp_secret_enc) values ($1,$2,$3) returning id`,
      [u, hash, encrypt(secret, "totp-enc")],
    );
    return { ownerId: r.rows[0].id, secret, otpauth: otpauthUrl(secret, u, "Dawati") };
  });
}

/** Step 2: prove the authenticator works; only then the account becomes usable. */
export async function completeOwnerSetup(db: Db, ownerId: string, code: string): Promise<void> {
  await db.tx(async (q) => {
    const r = await q.query<{ totp_secret_enc: string; totp_enabled: boolean }>(`select totp_secret_enc, totp_enabled from admin_users where id = $1 for update`, [ownerId]);
    const row = r.rows[0];
    if (!row || row.totp_enabled) throw new UserError("انتهت جلسة الإعداد، أعد المحاولة");
    const step = verifyTotp(decrypt(row.totp_secret_enc, "totp-enc"), code, 0);
    if (step === null) throw new UserError("رمز التحقق غير صحيح");
    await q.query(`update admin_users set totp_enabled = true, totp_last_step = $2 where id = $1`, [ownerId, step]);
    await audit(q, { actorType: "owner", actorId: ownerId, action: "owner.mfa_enabled" });
  });
}

const GENERIC_LOGIN_ERROR = "بيانات الدخول غير صحيحة";

export async function ownerLogin(db: Db, input: { username: string; password: string; code: string; ipHash: string }): Promise<{ ownerId: string }> {
  const u = input.username.trim().toLowerCase().slice(0, 60);
  if (!(await rateLimit(db, `owner-login-ip:${input.ipHash}`, 10, 900))) throw new UserError("محاولات كثيرة، حاول بعد 15 دقيقة", "rate_limited");
  if (!(await rateLimit(db, `owner-login-user:${u}`, 10, 900))) throw new UserError("محاولات كثيرة، حاول بعد 15 دقيقة", "rate_limited");
  const r = await db.query<{ id: string; password_hash: string; totp_secret_enc: string; totp_enabled: boolean; totp_last_step: number; locked: boolean }>(
    `select id, password_hash, totp_secret_enc, totp_enabled, totp_last_step, coalesce(locked_until > now(), false) as locked from admin_users where username = $1`,
    [u],
  );
  const row = r.rows[0];
  const pwOk = await verifyPassword(input.password, row?.password_hash ?? (await dummyHash()));
  if (!row || !row.totp_enabled) throw new UserError(GENERIC_LOGIN_ERROR, "unauthorized");
  if (row.locked) throw new UserError("تم قفل الحساب مؤقتاً بسبب محاولات فاشلة، حاول لاحقاً", "rate_limited");
  const step = pwOk ? verifyTotp(decrypt(row.totp_secret_enc, "totp-enc"), input.code, num(row.totp_last_step)) : null;
  if (!pwOk || step === null) {
    await db.query(
      `update admin_users set failed_attempts = failed_attempts + 1,
              locked_until = case when failed_attempts + 1 >= 8 then now() + interval '15 minutes' else locked_until end
        where id = $1`,
      [row.id],
    );
    await audit(db, { actorType: "owner", actorId: row.id, action: "owner.login_failed", ipHash: input.ipHash });
    throw new UserError(GENERIC_LOGIN_ERROR, "unauthorized");
  }
  await db.query(`update admin_users set failed_attempts = 0, locked_until = null, totp_last_step = $2, last_login_at = now() where id = $1`, [row.id, step]);
  await audit(db, { actorType: "owner", actorId: row.id, action: "owner.login", ipHash: input.ipHash });
  return { ownerId: row.id };
}

export async function ownerIsValid(q: Queryable, ownerId: string): Promise<{ username: string } | null> {
  const r = await q.query<{ username: string }>(`select username from admin_users where id = $1 and totp_enabled`, [ownerId]);
  return r.rows[0] ?? null;
}

// ------------------------------------------------------------------ CRM queries

export async function overviewStats(q: Queryable) {
  const r = await q.query<Record<string, unknown>>(`
    select
      coalesce((select sum(amount_minor) from payments), 0)::bigint as gross,
      coalesce((select sum(amount_minor) from refunds), 0)::bigint as refunded,
      coalesce((select sum(amount_minor) from payments where received_at >= date_trunc('day', now())), 0)::bigint as today,
      coalesce((select sum(amount_minor) from payments where received_at >= now() - interval '7 days'), 0)::bigint as week,
      coalesce((select sum(amount_minor) from payments where received_at >= date_trunc('month', now())), 0)::bigint as month,
      (select count(*)::int from orders) as orders_total,
      (select count(*)::int from orders where status in ('paid','partially_refunded')) as orders_paid,
      (select count(*)::int from orders where created_at >= date_trunc('month', now())) as orders_month,
      (select count(*)::int from orders where affiliate_id is not null and status in ('paid','partially_refunded','refunded')) as affiliate_orders,
      (select count(*)::int from customer_workspaces where status = 'active') as active_workspaces,
      (select count(*)::int from guests where deleted_at is null) as guests,
      (select count(*)::int from rsvp_responses where status = 'accepted') as rsvp_yes,
      (select count(*)::int from rsvp_responses where status = 'declined') as rsvp_no,
      coalesce((select sum(amount_minor) from commission_records where status in ('pending','approved')), 0)::bigint as commission_owed,
      coalesce((select sum(amount_minor) from payments where received_by_type = 'affiliate' and remitted_at is null), 0)::bigint as cash_with_affiliates,
      (select count(*)::int from refunds) as refunds_count
  `);
  const x = r.rows[0];
  const series = await q.query<{ d: string; amount: number }>(`
    select to_char(d, 'YYYY-MM-DD') as d, coalesce(sum(p.amount_minor), 0)::bigint as amount
      from generate_series(date_trunc('day', now()) - interval '29 days', date_trunc('day', now()), interval '1 day') d
      left join payments p on date_trunc('day', p.received_at) = d
     group by d order by d`);
  const popular = await q.query<{ name_ar: string; c: number }>(`
    select t.name_ar, count(*)::int as c from orders o join themes t on t.id = o.theme_id
     where o.status in ('paid','partially_refunded') group by t.name_ar order by c desc limit 5`);
  return {
    grossMinor: num(x.gross),
    refundedMinor: num(x.refunded),
    netMinor: num(x.gross) - num(x.refunded),
    todayMinor: num(x.today),
    weekMinor: num(x.week),
    monthMinor: num(x.month),
    ordersTotal: num(x.orders_total),
    ordersPaid: num(x.orders_paid),
    ordersMonth: num(x.orders_month),
    affiliateOrders: num(x.affiliate_orders),
    activeWorkspaces: num(x.active_workspaces),
    guests: num(x.guests),
    rsvpYes: num(x.rsvp_yes),
    rsvpNo: num(x.rsvp_no),
    commissionOwedMinor: num(x.commission_owed),
    cashWithAffiliatesMinor: num(x.cash_with_affiliates),
    refundsCount: num(x.refunds_count),
    series: series.rows.map((s) => ({ date: s.d, amountMinor: num(s.amount) })),
    popular: popular.rows.map((p) => ({ name: p.name_ar, count: num(p.c) })),
  };
}

export async function listOrders(q: Queryable, filter: { status?: string; search?: string; affiliateId?: string } = {}) {
  const s = (filter.search || "").trim();
  const r = await q.query<Record<string, unknown>>(
    `select o.*, t.name_ar as theme_name, tv.version as theme_version, a.name as affiliate_name, a.referral_code,
            w.id as workspace_id, w.status as workspace_status, w.access_expires_at,
            p.id as payment_id, p.received_by_type, p.remitted_at,
            coalesce((select sum(amount_minor) from refunds rf where rf.order_id = o.id), 0)::bigint as refunded,
            (select count(*)::int from guests g join invitations i on i.id = g.invitation_id where i.workspace_id = w.id and g.deleted_at is null) as guests_used,
            (select count(*)::int from rsvp_responses rr join invitations i on i.id = rr.invitation_id where i.workspace_id = w.id and rr.status = 'accepted') as rsvp_yes
       from orders o
       join themes t on t.id = o.theme_id
       join theme_versions tv on tv.id = o.theme_version_id
       left join affiliates a on a.id = o.affiliate_id
       left join customer_workspaces w on w.order_id = o.id
       left join payments p on p.order_id = o.id
      where ($1::text is null or o.status = $1)
        and ($3::uuid is null or o.affiliate_id = $3)
        and ($2 = '' or o.reference ilike '%' || $2 || '%' or o.customer_name ilike '%' || $2 || '%' or o.customer_phone ilike '%' || $2 || '%')
      order by o.created_at desc limit 300`,
    [filter.status || null, s, filter.affiliateId || null],
  );
  return r.rows.map((x) => ({
    id: x.id as string,
    reference: x.reference as string,
    status: x.status as string,
    themeName: x.theme_name as string,
    themeVersion: num(x.theme_version),
    variant: x.color_variant_key as string,
    guestLimit: num(x.guest_limit),
    guestsUsed: num(x.guests_used),
    rsvpYes: num(x.rsvp_yes),
    listPriceMinor: num(x.list_price_minor),
    amountMinor: num(x.amount_minor),
    refundedMinor: num(x.refunded),
    currency: x.currency as string,
    customerName: x.customer_name as string,
    customerPhone: x.customer_phone as string,
    affiliateName: (x.affiliate_name as string) ?? null,
    referralCode: (x.referral_code as string) ?? null,
    attributionSource: (x.attribution_source as string) ?? null,
    issuedByType: x.issued_by_type as string,
    workspaceId: (x.workspace_id as string) ?? null,
    workspaceStatus: (x.workspace_status as string) ?? null,
    accessExpiresAt: x.access_expires_at ? new Date(x.access_expires_at as string).toISOString() : null,
    paymentId: (x.payment_id as string) ?? null,
    receivedByType: (x.received_by_type as string) ?? null,
    remittedAt: x.remitted_at ? new Date(x.remitted_at as string).toISOString() : null,
    note: (x.note as string) || "",
    createdAt: new Date(x.created_at as string).toISOString(),
  }));
}

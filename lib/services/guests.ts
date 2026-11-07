import "server-only";
import type { Db, Queryable } from "@/lib/db";
import { num } from "@/lib/db";
import { newGuestToken, hashGuestToken } from "@/lib/security/tokens";
import { encrypt, decrypt } from "@/lib/security/crypto";
import { audit } from "@/lib/security/audit";
import { rateLimit } from "@/lib/security/rateLimit";
import type { InvitationContent, InvitationSettings, PagesConfig, RsvpStatus, ColorVariantKey } from "@/lib/invitation/types";
import { getSettings } from "./settings";
import { UserError } from "./errors";

/*
 * Guest links: one live link per guest (unique partial index). Default expiry = 7 days after the
 * link was CREATED, computed and enforced by the database clock (never the client's clock).
 * Re-issuing revokes the previous URL immediately; the guest record and any RSVP stay intact.
 * The raw token is kept AES-GCM encrypted so the customer can copy the link again; lookups use
 * the HMAC hash only.
 */

export type LinkState = "active" | "expired" | "revoked" | "none";
export const LINK_STATE_AR: Record<LinkState, string> = { active: "فعّال", expired: "منتهي", revoked: "ملغى", none: "بدون رابط" };
export const RSVP_AR: Record<RsvpStatus | "awaiting", string> = { accepted: "سيحضر", declined: "اعتذر", awaiting: "في انتظار الرد" };

export interface GuestListItem {
  id: string;
  name: string;
  maxPartySize: number;
  linkState: LinkState;
  linkUrl: string | null;
  linkCreatedAt: string | null;
  linkExpiresAt: string | null;
  openedAt: string | null;
  openCount: number;
  rsvp: RsvpStatus | null;
  partySize: number;
  respondedAt: string | null;
}

export function guestUrl(base: string, raw: string) {
  return `${base}/i/${raw}`;
}

export function cleanGuestName(s: string): string {
  return (s || "").normalize("NFKC").replace(/[\u0000-\u001f\u007f<>]/g, "").replace(/\s+/g, " ").trim().slice(0, 120);
}

export async function listGuests(q: Queryable, invitationId: string, baseUrl: string): Promise<GuestListItem[]> {
  const r = await q.query<Record<string, unknown>>(
    `select g.id, g.display_name, g.max_party_size,
            l.token_enc, l.created_at as l_created, l.expires_at, l.revoked_at, l.first_opened_at, l.open_count,
            (l.expires_at <= now()) as l_expired,
            r.status as rsvp_status, r.party_size, r.updated_at as responded_at
       from guests g
       left join lateral (
         select * from guest_links gl where gl.guest_id = g.id order by (gl.revoked_at is null) desc, gl.created_at desc limit 1
       ) l on true
       left join rsvp_responses r on r.guest_id = g.id
      where g.invitation_id = $1 and g.deleted_at is null
      order by g.created_at asc`,
    [invitationId],
  );
  return r.rows.map((x) => {
    let state: LinkState = "none";
    let url: string | null = null;
    if (x.token_enc) {
      state = x.revoked_at ? "revoked" : x.l_expired ? "expired" : "active";
      if (state === "active") {
        try {
          url = guestUrl(baseUrl, decrypt(x.token_enc as string, "guest-link-enc"));
        } catch {
          url = null;
        }
      }
    }
    const iso = (d: unknown) => (d ? new Date(d as string).toISOString() : null);
    return {
      id: x.id as string,
      name: x.display_name as string,
      maxPartySize: num(x.max_party_size),
      linkState: state,
      linkUrl: url,
      linkCreatedAt: iso(x.l_created),
      linkExpiresAt: iso(x.expires_at),
      openedAt: iso(x.first_opened_at),
      openCount: num(x.open_count),
      rsvp: (x.rsvp_status as RsvpStatus) ?? null,
      partySize: num(x.party_size),
      respondedAt: iso(x.responded_at),
    };
  });
}

async function createLink(q: Queryable, invitationId: string, guestId: string, days: number): Promise<void> {
  await q.query(`update guest_links set revoked_at = now() where guest_id = $1 and revoked_at is null`, [guestId]);
  const t = newGuestToken();
  await q.query(
    `insert into guest_links (guest_id, invitation_id, token_hash, token_enc, expires_at)
     values ($1,$2,$3,$4, now() + make_interval(days => $5::int))`,
    [guestId, invitationId, t.hash, encrypt(t.raw, "guest-link-enc"), days],
  );
}

export async function addGuests(db: Db, invitationId: string, names: string[], maxPartySize: number, workspaceId: string): Promise<number> {
  const clean = names.map(cleanGuestName).filter(Boolean);
  if (clean.length === 0) throw new UserError("أدخل اسم ضيف واحد على الأقل");
  if (clean.length > 300) throw new UserError("يمكن إضافة 300 اسم كحد أقصى في المرة الواحدة");
  const party = Math.min(50, Math.max(1, Math.trunc(maxPartySize || 1)));
  return db.tx(async (q) => {
    const settings = await getSettings(q);
    const inv = await q.query<{ guest_limit: number }>(`select guest_limit from invitations where id = $1 for update`, [invitationId]);
    const limit = Math.min(num(inv.rows[0]?.guest_limit), settings.maxGuestsPerInvitation);
    const count = num((await q.query<{ c: number }>(`select count(*)::int as c from guests where invitation_id = $1 and deleted_at is null`, [invitationId])).rows[0].c);
    if (count + clean.length > limit) {
      const left = Math.max(0, limit - count);
      throw new UserError(left === 0 ? `وصلت إلى الحد الأقصى لعدد المدعوين في باقتك (${limit}). تواصل معنا لزيادة العدد.` : `باقتك تسمح بإضافة ${left} ${left === 1 ? "ضيف" : "ضيوف"} فقط (الحد ${limit}).`);
    }
    for (const name of clean) {
      const g = await q.query<{ id: string }>(`insert into guests (invitation_id, display_name, max_party_size) values ($1,$2,$3) returning id`, [invitationId, name, party]);
      await createLink(q, invitationId, g.rows[0].id, settings.guestLinkDays);
    }
    await audit(q, { actorType: "customer", actorId: workspaceId, action: "guests.added", targetType: "invitation", targetId: invitationId, details: { count: clean.length } });
    return clean.length;
  });
}

async function ownGuest(q: Queryable, invitationId: string, guestId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(guestId)) throw new UserError("الضيف غير موجود", "not_found");
  const r = await q.query<{ id: string }>(`select id from guests where id = $1 and invitation_id = $2 and deleted_at is null`, [guestId, invitationId]);
  if (!r.rows[0]) throw new UserError("الضيف غير موجود", "not_found");
}

export async function updateGuest(db: Db, invitationId: string, guestId: string, patch: { name?: string; maxPartySize?: number }) {
  await db.tx(async (q) => {
    await ownGuest(q, invitationId, guestId);
    if (patch.name !== undefined) {
      const n = cleanGuestName(patch.name);
      if (!n) throw new UserError("اسم الضيف مطلوب");
      await q.query(`update guests set display_name = $3, updated_at = now() where id = $1 and invitation_id = $2`, [guestId, invitationId, n]);
    }
    if (patch.maxPartySize !== undefined) {
      const p = Math.min(50, Math.max(1, Math.trunc(patch.maxPartySize)));
      await q.query(`update guests set max_party_size = $3, updated_at = now() where id = $1 and invitation_id = $2`, [guestId, invitationId, p]);
    }
  });
}

export async function deleteGuest(db: Db, invitationId: string, guestId: string, workspaceId: string) {
  await db.tx(async (q) => {
    await ownGuest(q, invitationId, guestId);
    await q.query(`update guests set deleted_at = now() where id = $1 and invitation_id = $2`, [guestId, invitationId]);
    await q.query(`update guest_links set revoked_at = now() where guest_id = $1 and revoked_at is null`, [guestId]);
    await audit(q, { actorType: "customer", actorId: workspaceId, action: "guest.deleted", targetType: "guest", targetId: guestId });
  });
}

export async function reissueGuestLink(db: Db, invitationId: string, guestId: string, workspaceId: string) {
  await db.tx(async (q) => {
    await ownGuest(q, invitationId, guestId);
    const s = await getSettings(q);
    await createLink(q, invitationId, guestId, s.guestLinkDays);
    await audit(q, { actorType: "customer", actorId: workspaceId, action: "guest.link_reissued", targetType: "guest", targetId: guestId });
  });
}

export async function revokeGuestLink(db: Db, invitationId: string, guestId: string, workspaceId: string) {
  await db.tx(async (q) => {
    await ownGuest(q, invitationId, guestId);
    await q.query(`update guest_links set revoked_at = now() where guest_id = $1 and revoked_at is null`, [guestId]);
    await audit(q, { actorType: "customer", actorId: workspaceId, action: "guest.link_revoked", targetType: "guest", targetId: guestId });
  });
}

export async function rsvpStats(q: Queryable, invitationId: string) {
  const r = await q.query<Record<string, unknown>>(
    `select count(*)::int as total,
            count(*) filter (where r.status = 'accepted')::int as accepted,
            coalesce(sum(r.party_size) filter (where r.status = 'accepted'), 0)::int as attendees,
            count(*) filter (where r.status = 'declined')::int as declined,
            count(*) filter (where r.status is null)::int as awaiting,
            count(*) filter (where exists (select 1 from guest_links gl where gl.guest_id = g.id and gl.first_opened_at is not null))::int as opened
       from guests g left join rsvp_responses r on r.guest_id = g.id
      where g.invitation_id = $1 and g.deleted_at is null`,
    [invitationId],
  );
  const x = r.rows[0] ?? {};
  return { total: num(x.total), accepted: num(x.accepted), attendees: num(x.attendees), declined: num(x.declined), awaiting: num(x.awaiting), opened: num(x.opened) };
}

// ------------------------------------------------------------------ guest-facing

export type GuestResolution =
  | { state: "ok"; linkId: string; guestId: string; invitationId: string; guestName: string; maxPartySize: number; expiresAt: string;
      renderer: string; variant: ColorVariantKey; content: InvitationContent; pages: PagesConfig; settings: InvitationSettings;
      rsvp: { status: RsvpStatus; partySize: number } | null }
  | { state: "not_found" | "expired" | "revoked" | "unavailable" };

export async function resolveGuestLink(q: Queryable, raw: string): Promise<GuestResolution> {
  const hash = hashGuestToken(raw);
  if (!hash) return { state: "not_found" };
  const r = await q.query<Record<string, unknown>>(
    `select gl.id as link_id, gl.guest_id, gl.invitation_id, gl.revoked_at, gl.expires_at, (gl.expires_at <= now()) as expired,
            g.display_name, g.max_party_size, g.deleted_at,
            i.content, i.pages, i.settings, i.color_variant_key, i.status as inv_status,
            tv.renderer, w.status as ws_status, (w.access_expires_at <= now()) as ws_expired,
            r.status as rsvp_status, r.party_size
       from guest_links gl
       join guests g on g.id = gl.guest_id
       join invitations i on i.id = gl.invitation_id
       join theme_versions tv on tv.id = i.theme_version_id
       join customer_workspaces w on w.id = i.workspace_id
       left join rsvp_responses r on r.guest_id = g.id
      where gl.token_hash = $1`,
    [hash],
  );
  const x = r.rows[0];
  if (!x) return { state: "not_found" };
  if (x.revoked_at || x.deleted_at) return { state: "revoked" };
  if (x.expired) return { state: "expired" };
  if (x.inv_status !== "active" || x.ws_status !== "active" || x.ws_expired) return { state: "unavailable" };
  return {
    state: "ok",
    linkId: x.link_id as string,
    guestId: x.guest_id as string,
    invitationId: x.invitation_id as string,
    guestName: x.display_name as string,
    maxPartySize: num(x.max_party_size),
    expiresAt: new Date(x.expires_at as string).toISOString(),
    renderer: x.renderer as string,
    variant: x.color_variant_key as ColorVariantKey,
    content: x.content as InvitationContent,
    pages: x.pages as PagesConfig,
    settings: x.settings as InvitationSettings,
    rsvp: x.rsvp_status ? { status: x.rsvp_status as RsvpStatus, partySize: num(x.party_size) } : null,
  };
}

/** Counts a real human opening (called from the page after the guest taps the seal, never on crawler GETs). */
export async function markGuestOpened(db: Db, raw: string): Promise<boolean> {
  const g = await resolveGuestLink(db, raw);
  if (g.state !== "ok") return false;
  if (!(await rateLimit(db, `open:${g.linkId}`, 30, 3600))) return true;
  await db.query(
    `update guest_links set first_opened_at = coalesce(first_opened_at, now()), last_opened_at = now(), open_count = open_count + 1 where id = $1`,
    [g.linkId],
  );
  return true;
}

export async function submitRsvp(
  db: Db,
  raw: string,
  status: RsvpStatus,
  partySizeIn: number,
  ipHash: string,
): Promise<{ ok: true } | { ok: false; error: string; code: number }> {
  if (status !== "accepted" && status !== "declined") return { ok: false, error: "رد غير صالح", code: 400 };
  return db.tx(async (q) => {
    const g = await resolveGuestLink(q, raw);
    if (g.state === "expired") return { ok: false as const, error: "انتهت صلاحية رابط هذه الدعوة", code: 410 };
    if (g.state !== "ok") return { ok: false as const, error: "هذا الرابط غير صالح", code: 404 };
    if (!g.settings.rsvpEnabled) return { ok: false as const, error: "تأكيد الحضور غير متاح لهذه الدعوة", code: 400 };
    if (!(await rateLimit(q, `rsvp:${g.linkId}`, 20, 3600))) return { ok: false as const, error: "محاولات كثيرة، حاولوا لاحقاً", code: 429 };
    let party = 0;
    if (status === "accepted") {
      const max = g.settings.allowPartySize ? Math.max(1, g.maxPartySize) : 1;
      party = Math.trunc(Number(partySizeIn) || 1);
      if (party < 1 || party > max) return { ok: false as const, error: `عدد الحاضرين يجب أن يكون بين 1 و ${max}`, code: 400 };
    }
    await q.query(
      `insert into rsvp_responses (guest_id, invitation_id, status, party_size, link_id) values ($1,$2,$3,$4,$5)
       on conflict (guest_id) do update set status = excluded.status, party_size = excluded.party_size, link_id = excluded.link_id, updated_at = now()`,
      [g.guestId, g.invitationId, status, party, g.linkId],
    );
    await q.query(`insert into rsvp_history (guest_id, status, party_size, link_id, ip_hash) values ($1,$2,$3,$4,$5)`, [g.guestId, status, party, g.linkId, ipHash]);
    return { ok: true as const };
  });
}

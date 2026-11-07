import "server-only";
import { z } from "zod";
import type { Db, Queryable } from "@/lib/db";
import { num } from "@/lib/db";
import { audit } from "@/lib/security/audit";
import type { InvitationContent, InvitationSettings, PagesConfig, ColorVariantKey, InvitationViewModel } from "@/lib/invitation/types";
import { EVENT_TYPES } from "@/lib/invitation/types";
import { defaultContent, defaultPages, defaultSettings } from "@/lib/invitation/defaults";
import { variantsForVersion } from "./catalog";
import { UserError } from "./errors";

export interface WorkspaceInfo {
  workspaceId: string;
  workspaceStatus: string;
  accessExpiresAt: string;
  recoveryPhone: string;
  orderId: string;
  orderReference: string;
  orderStatus: string;
  customerName: string;
  guestLimit: number;
  themeName: string;
  themeSlug: string;
  invitationId: string;
  themeVersionId: string;
  renderer: string;
  variant: ColorVariantKey;
  content: InvitationContent;
  pages: PagesConfig;
  settings: InvitationSettings;
  invitationStatus: string;
  updatedAt: string;
}

/** Everything is looked up FROM the session's workspace id; client-supplied ids are never trusted. */
export async function getWorkspace(q: Queryable, workspaceId: string): Promise<WorkspaceInfo | null> {
  const r = await q.query<Record<string, unknown>>(
    `select w.id as ws_id, w.status as ws_status, w.access_expires_at, w.recovery_phone,
            o.id as order_id, o.reference, o.status as order_status, o.customer_name, i.guest_limit,
            t.name_ar, t.slug, i.id as inv_id, i.theme_version_id, tv.renderer, i.color_variant_key,
            i.content, i.pages, i.settings, i.status as inv_status, i.updated_at
       from customer_workspaces w
       join orders o on o.id = w.order_id
       join themes t on t.id = o.theme_id
       join invitations i on i.workspace_id = w.id
       join theme_versions tv on tv.id = i.theme_version_id
      where w.id = $1`,
    [workspaceId],
  );
  const x = r.rows[0];
  if (!x) return null;
  return {
    workspaceId: x.ws_id as string,
    workspaceStatus: x.ws_status as string,
    accessExpiresAt: new Date(x.access_expires_at as string).toISOString(),
    recoveryPhone: (x.recovery_phone as string) || "",
    orderId: x.order_id as string,
    orderReference: x.reference as string,
    orderStatus: x.order_status as string,
    customerName: (x.customer_name as string) || "",
    guestLimit: num(x.guest_limit),
    themeName: x.name_ar as string,
    themeSlug: x.slug as string,
    invitationId: x.inv_id as string,
    themeVersionId: x.theme_version_id as string,
    renderer: x.renderer as string,
    variant: x.color_variant_key as ColorVariantKey,
    content: { ...defaultContent(), ...(x.content as Partial<InvitationContent>) },
    pages: { ...defaultPages(), ...(x.pages as Partial<PagesConfig>) },
    settings: { ...defaultSettings(), ...(x.settings as Partial<InvitationSettings>) },
    invitationStatus: x.inv_status as string,
    updatedAt: new Date(x.updated_at as string).toISOString(),
  };
}

export function previewViewModel(ws: WorkspaceInfo, guestName = "اسم الضيف"): InvitationViewModel {
  return {
    renderer: ws.renderer,
    variant: ws.variant,
    content: ws.content,
    pages: ws.pages,
    settings: ws.settings,
    mode: "preview",
    guest: { name: guestName, maxPartySize: ws.settings.defaultMaxPartySize, rsvp: null, expiresAt: "" },
  };
}

const text = (max: number) =>
  z
    .string()
    .max(max, { message: `النص طويل جداً (الحد ${max} حرفاً)` })
    .transform((s) => s.normalize("NFKC").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim());

const httpsUrl = z
  .string()
  .max(500)
  .transform((s) => s.trim())
  .refine((s) => {
    if (!s) return true;
    try {
      return new URL(s).protocol === "https:";
    } catch {
      return false;
    }
  }, { message: "رابط الخريطة يجب أن يبدأ بـ https://" });

export const contentSchema = z.object({
  eventType: z.enum(EVENT_TYPES),
  groomName: text(60),
  brideName: text(60),
  eventTitle: text(80),
  hostLine: text(140),
  showBismillah: z.boolean(),
  openingLine: text(120),
  inviteLine: text(160),
  guestGreeting: text(40),
  initials: text(8),
  eventDate: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/, { message: "صيغة التاريخ غير صحيحة" }),
  eventTime: z.string().regex(/^(\d{2}:\d{2})?$/, { message: "صيغة الوقت غير صحيحة" }),
  timeNote: text(80),
  venueName: text(120),
  address: text(240),
  mapsUrl: httpsUrl,
  welcomeMessage: text(600),
  customMessage: text(1200),
  closingMessage: text(400),
});

export const pagesSchema = z.object({
  welcome: z.boolean(),
  details: z.boolean(),
  venue: z.boolean(),
  photos: z.boolean(),
  message: z.boolean(),
  rsvp: z.boolean(),
  thanks: z.boolean(),
});

export const settingsSchema = z.object({
  allowPartySize: z.boolean(),
  defaultMaxPartySize: z.number().int().min(1).max(50),
  rsvpEnabled: z.boolean(),
});

export function firstZodError(e: z.ZodError): string {
  return e.issues[0]?.message || "البيانات غير صحيحة";
}

export async function saveInvitation(
  db: Db,
  workspaceId: string,
  input: { content: unknown; pages: unknown; settings: unknown; variant: string; expectedUpdatedAt?: string },
): Promise<{ updatedAt: string }> {
  const c = contentSchema.safeParse(input.content);
  if (!c.success) throw new UserError(firstZodError(c.error));
  const p = pagesSchema.safeParse(input.pages);
  if (!p.success) throw new UserError("إعدادات الصفحات غير صحيحة");
  const s = settingsSchema.safeParse(input.settings);
  if (!s.success) throw new UserError("إعدادات تأكيد الحضور غير صحيحة");
  return db.tx(async (q) => {
    const ws = await getWorkspace(q, workspaceId);
    if (!ws) throw new UserError("مساحة الدعوة غير موجودة", "not_found");
    if (ws.workspaceStatus !== "active") throw new UserError("تم إيقاف هذه الدعوة مؤقتاً");
    const variants = await variantsForVersion(q, ws.themeVersionId);
    const variant = variants.find((v) => v.key === input.variant && v.status === "active");
    if (!variant) throw new UserError("اللون المختار غير متاح لهذا التصميم");
    // keep server-managed fields (photos, music) from the stored content
    const merged: InvitationContent = { ...ws.content, ...c.data, photos: ws.content.photos, musicUrl: ws.content.musicUrl };
    const r = await q.query<{ updated_at: Date }>(
      `update invitations set content = $2, pages = $3, settings = $4, color_variant_key = $5, updated_at = now()
        where workspace_id = $1 returning updated_at`,
      [workspaceId, JSON.stringify(merged), JSON.stringify(p.data), JSON.stringify(s.data), variant.key],
    );
    await audit(q, { actorType: "customer", actorId: workspaceId, action: "invitation.saved", targetType: "invitation", targetId: ws.invitationId });
    return { updatedAt: new Date(r.rows[0].updated_at).toISOString() };
  });
}

/**
 * Customer switches their invitation to another active design (its current published version, default
 * colour). Only designs priced at or below the design they bought; content, guests, links and RSVPs stay.
 */
export async function changeInvitationTheme(db: Db, workspaceId: string, themeSlug: string): Promise<void> {
  await db.tx(async (q) => {
    const ws = await getWorkspace(q, workspaceId);
    if (!ws) throw new UserError("مساحة الدعوة غير موجودة", "not_found");
    if (ws.workspaceStatus !== "active") throw new UserError("تم إيقاف هذه الدعوة مؤقتاً");
    const cur = await q.query<{ price_minor: number }>(
      `select t.price_minor from theme_versions tv join themes t on t.id = tv.theme_id where tv.id = $1`,
      [ws.themeVersionId],
    );
    const next = await q.query<{ version_id: string; price_minor: number; variant_key: string | null }>(
      `select v.id as version_id, t.price_minor,
              (select key from theme_color_variants cv where cv.theme_version_id = v.id and cv.status = 'active'
                order by cv.is_default desc, cv.sort_order limit 1) as variant_key
         from themes t
         join lateral (select * from theme_versions tv where tv.theme_id = t.id and tv.status = 'published'
                        order by tv.version desc limit 1) v on true
        where t.slug = $1 and t.status = 'active'`,
      [themeSlug],
    );
    const n = next.rows[0];
    if (!n || !n.variant_key) throw new UserError("هذا التصميم غير متاح حالياً");
    if (num(n.price_minor) > num(cur.rows[0]?.price_minor ?? 0)) throw new UserError("هذا التصميم يتطلب ترقية الباقة، تواصل معنا");
    if (n.version_id === ws.themeVersionId) return;
    await q.query(
      `update invitations set theme_version_id = $2, color_variant_key = $3, updated_at = now() where workspace_id = $1`,
      [workspaceId, n.version_id, n.variant_key],
    );
    await audit(q, { actorType: "customer", actorId: workspaceId, action: "invitation.theme_changed", targetType: "invitation", targetId: ws.invitationId, details: { theme: themeSlug } });
  });
}

export async function setRecoveryPhone(q: Queryable, workspaceId: string, phone: string) {
  const p = phone.trim().slice(0, 30);
  if (p && !/^\+?[0-9\s-]{7,20}$/.test(p)) throw new UserError("رقم الهاتف غير صحيح");
  await q.query(`update customer_workspaces set recovery_phone = $2, updated_at = now() where id = $1`, [workspaceId, p]);
}

export async function photoCount(q: Queryable, invitationId: string): Promise<number> {
  return num((await q.query<{ c: number }>(`select count(*)::int as c from invitation_assets where invitation_id = $1 and kind = 'photo' and deleted_at is null`, [invitationId])).rows[0].c);
}

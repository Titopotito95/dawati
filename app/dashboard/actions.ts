"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import sharp, { type OutputInfo } from "sharp";
import { requireCustomer } from "@/lib/auth";
import { saveInvitation, setRecoveryPhone, photoCount } from "@/lib/services/workspace";
import { addGuests, updateGuest, deleteGuest, reissueGuestLink, revokeGuestLink } from "@/lib/services/guests";
import { issueCustomerToken } from "@/lib/services/orders";
import { getSettings } from "@/lib/services/settings";
import { putObject, deleteObject, newMediaKey } from "@/lib/services/storage";
import { createSession, destroySession } from "@/lib/security/sessions";
import { audit } from "@/lib/security/audit";
import { userMessage, UserError } from "@/lib/services/errors";
import type { ActionResult } from "@/components/ui/ActionForm";
import type { InvitationContent, InvitationPhoto } from "@/lib/invitation/types";

export async function saveInvitationAction(payload: { content: unknown; pages: unknown; settings: unknown; variant: string }): Promise<ActionResult> {
  const { db, ws } = await requireCustomer();
  try {
    const r = await saveInvitation(db, ws.workspaceId, payload);
    revalidatePath("/dashboard", "layout");
    return { ok: true, message: "تم حفظ التغييرات", data: { updatedAt: r.updatedAt } };
  } catch (e) {
    return { ok: false, message: userMessage(e) };
  }
}

async function patchServerContent(workspaceId: string, fn: (c: InvitationContent) => InvitationContent) {
  const { db } = await requireCustomer();
  await db.tx(async (q) => {
    const r = await q.query<{ content: InvitationContent }>(`select content from invitations where workspace_id = $1 for update`, [workspaceId]);
    const next = fn(r.rows[0].content);
    await q.query(`update invitations set content = $2, updated_at = now() where workspace_id = $1`, [workspaceId, JSON.stringify(next)]);
  });
}

export async function uploadPhotoAction(fd: FormData): Promise<ActionResult> {
  const { db, ws } = await requireCustomer();
  try {
    const settings = await getSettings(db);
    const file = fd.get("file");
    if (!(file instanceof Blob) || file.size === 0) throw new UserError("اختر صورة أولاً");
    if (file.size > settings.maxUploadMb * 1024 * 1024) throw new UserError(`حجم الصورة أكبر من ${settings.maxUploadMb} ميغابايت`);
    if ((await photoCount(db, ws.invitationId)) >= settings.maxPhotos) throw new UserError(`يمكن رفع ${settings.maxPhotos} صور كحد أقصى`);
    const input = Buffer.from(await file.arrayBuffer());
    let out: Buffer;
    let meta: OutputInfo;
    try {
      const res = await sharp(input, { limitInputPixels: 40_000_000 })
        .rotate()
        .resize({ width: 1400, height: 1750, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer({ resolveWithObject: true });
      out = res.data;
      meta = res.info;
    } catch {
      throw new UserError("صيغة الصورة غير مدعومة. استخدم JPG أو PNG أو WEBP");
    }
    const key = newMediaKey("webp");
    await putObject(key, out, "image/webp");
    const a = await db.query<{ id: string }>(
      `insert into invitation_assets (invitation_id, kind, storage_key, mime, bytes, width, height) values ($1,'photo',$2,'image/webp',$3,$4,$5) returning id`,
      [ws.invitationId, key, out.length, meta.width, meta.height],
    );
    const photo: InvitationPhoto = { id: a.rows[0].id, url: `/api/media/${key}`, width: meta.width, height: meta.height };
    await patchServerContent(ws.workspaceId, (c) => ({ ...c, photos: [...(c.photos || []), photo] }));
    revalidatePath("/dashboard", "layout");
    return { ok: true, message: "تم رفع الصورة", data: { photo } };
  } catch (e) {
    return { ok: false, message: userMessage(e) };
  }
}

export async function deletePhotoAction(photoId: string): Promise<ActionResult> {
  const { db, ws } = await requireCustomer();
  try {
    if (!/^[0-9a-f-]{36}$/i.test(photoId)) throw new UserError("الصورة غير موجودة");
    const r = await db.query<{ storage_key: string }>(
      `update invitation_assets set deleted_at = now() where id = $1 and invitation_id = $2 and deleted_at is null returning storage_key`,
      [photoId, ws.invitationId],
    );
    if (!r.rows[0]) throw new UserError("الصورة غير موجودة");
    await deleteObject(r.rows[0].storage_key);
    await patchServerContent(ws.workspaceId, (c) => ({ ...c, photos: (c.photos || []).filter((p) => p.id !== photoId) }));
    revalidatePath("/dashboard", "layout");
    return { ok: true, message: "تم حذف الصورة" };
  } catch (e) {
    return { ok: false, message: userMessage(e) };
  }
}

function sniffAudio(b: Buffer): "mp3" | "m4a" | null {
  if (b.length < 12) return null;
  if (b.subarray(0, 3).toString("latin1") === "ID3" || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0)) return "mp3";
  if (b.subarray(4, 8).toString("latin1") === "ftyp") return "m4a";
  return null;
}

export async function uploadMusicAction(fd: FormData): Promise<ActionResult> {
  const { db, ws } = await requireCustomer();
  try {
    const settings = await getSettings(db);
    if (!settings.allowMusic) throw new UserError("إضافة الموسيقى غير متاحة حالياً");
    const file = fd.get("file");
    if (!(file instanceof Blob) || file.size === 0) throw new UserError("اختر ملفاً صوتياً");
    if (file.size > 6 * 1024 * 1024) throw new UserError("حجم الملف الصوتي يجب ألا يتجاوز 6 ميغابايت");
    const buf = Buffer.from(await file.arrayBuffer());
    const kind = sniffAudio(buf);
    if (!kind) throw new UserError("الصيغة غير مدعومة. استخدم MP3 أو M4A");
    const key = newMediaKey(kind);
    const mime = kind === "mp3" ? "audio/mpeg" : "audio/mp4";
    await putObject(key, buf, mime);
    const old = await db.query<{ id: string; storage_key: string }>(
      `update invitation_assets set deleted_at = now() where invitation_id = $1 and kind = 'audio' and deleted_at is null returning id, storage_key`,
      [ws.invitationId],
    );
    for (const o of old.rows) await deleteObject(o.storage_key);
    await db.query(`insert into invitation_assets (invitation_id, kind, storage_key, mime, bytes) values ($1,'audio',$2,$3,$4)`, [ws.invitationId, key, mime, buf.length]);
    await patchServerContent(ws.workspaceId, (c) => ({ ...c, musicUrl: `/api/media/${key}` }));
    revalidatePath("/dashboard", "layout");
    return { ok: true, message: "تمت إضافة الموسيقى — لن تعمل إلا إذا ضغط الضيف زر التشغيل" };
  } catch (e) {
    return { ok: false, message: userMessage(e) };
  }
}

export async function removeMusicAction(): Promise<ActionResult> {
  const { db, ws } = await requireCustomer();
  const old = await db.query<{ storage_key: string }>(
    `update invitation_assets set deleted_at = now() where invitation_id = $1 and kind = 'audio' and deleted_at is null returning storage_key`,
    [ws.invitationId],
  );
  for (const o of old.rows) await deleteObject(o.storage_key);
  await patchServerContent(ws.workspaceId, (c) => ({ ...c, musicUrl: "" }));
  revalidatePath("/dashboard", "layout");
  return { ok: true, message: "تمت إزالة الموسيقى" };
}

export async function addGuestsAction(names: string[], maxPartySize: number): Promise<ActionResult> {
  const { db, ws } = await requireCustomer();
  try {
    if (!Array.isArray(names)) throw new UserError("قائمة الأسماء غير صحيحة");
    const n = await addGuests(db, ws.invitationId, names.slice(0, 300).map(String), Number(maxPartySize) || 1, ws.workspaceId);
    revalidatePath("/dashboard", "layout");
    return { ok: true, message: n === 1 ? "تمت إضافة الضيف وإنشاء رابطه" : `تمت إضافة ${n} ضيوف وإنشاء روابطهم` };
  } catch (e) {
    return { ok: false, message: userMessage(e) };
  }
}

export async function updateGuestAction(guestId: string, patch: { name?: string; maxPartySize?: number }): Promise<ActionResult> {
  const { db, ws } = await requireCustomer();
  try {
    await updateGuest(db, ws.invitationId, String(guestId), { name: patch.name === undefined ? undefined : String(patch.name), maxPartySize: patch.maxPartySize === undefined ? undefined : Number(patch.maxPartySize) });
    revalidatePath("/dashboard", "layout");
    return { ok: true, message: "تم الحفظ" };
  } catch (e) {
    return { ok: false, message: userMessage(e) };
  }
}

export async function deleteGuestAction(guestId: string): Promise<ActionResult> {
  const { db, ws } = await requireCustomer();
  try {
    await deleteGuest(db, ws.invitationId, String(guestId), ws.workspaceId);
    revalidatePath("/dashboard", "layout");
    return { ok: true, message: "تم حذف الضيف وإلغاء رابطه" };
  } catch (e) {
    return { ok: false, message: userMessage(e) };
  }
}

export async function reissueLinkAction(guestId: string): Promise<ActionResult> {
  const { db, ws } = await requireCustomer();
  try {
    await reissueGuestLink(db, ws.invitationId, String(guestId), ws.workspaceId);
    revalidatePath("/dashboard", "layout");
    return { ok: true, message: "تم إنشاء رابط جديد وإلغاء الرابط السابق" };
  } catch (e) {
    return { ok: false, message: userMessage(e) };
  }
}

export async function revokeLinkAction(guestId: string): Promise<ActionResult> {
  const { db, ws } = await requireCustomer();
  try {
    await revokeGuestLink(db, ws.invitationId, String(guestId), ws.workspaceId);
    revalidatePath("/dashboard", "layout");
    return { ok: true, message: "تم إلغاء الرابط" };
  } catch (e) {
    return { ok: false, message: userMessage(e) };
  }
}

/** New dashboard token: old token and every other session stop working; this browser stays signed in. */
export async function rotateTokenAction(_p: ActionResult | null, _fd?: FormData): Promise<ActionResult> {
  const { db, ws } = await requireCustomer();
  const token = await db.tx(async (q) => {
    const t = await issueCustomerToken(q, ws.workspaceId, "rotation");
    await audit(q, { actorType: "customer", actorId: ws.workspaceId, action: "credential.rotated" });
    return t;
  });
  await createSession(db, "customer", ws.workspaceId);
  return { ok: true, message: "تم إنشاء رمز دخول جديد وإلغاء الرمز السابق", data: { token } };
}

export async function setPhoneAction(_p: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const { db, ws } = await requireCustomer();
  try {
    await setRecoveryPhone(db, ws.workspaceId, String(fd.get("phone") || ""));
    return { ok: true, message: "تم حفظ رقم الهاتف" };
  } catch (e) {
    return { ok: false, message: userMessage(e) };
  }
}

export async function logoutAction() {
  await destroySession("customer");
  redirect("/access?bye=1");
}

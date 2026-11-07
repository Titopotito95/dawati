"use server";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { ownerLogin, beginOwnerSetup, completeOwnerSetup, checkSetupToken, ownerExists } from "@/lib/services/owner";
import { createSession, destroySession } from "@/lib/security/sessions";
import { clientIp } from "@/lib/security/request";
import { hashIp } from "@/lib/security/crypto";
import { rateLimit } from "@/lib/security/rateLimit";
import { userMessage } from "@/lib/services/errors";
import QRCode from "qrcode";
import type { ActionResult } from "@/components/ui/ActionForm";

export async function ownerLoginAction(_p: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const db = await getDb();
  let ownerId: string;
  try {
    const r = await ownerLogin(db, {
      username: String(fd.get("username") || ""),
      password: String(fd.get("password") || ""),
      code: String(fd.get("code") || ""),
      ipHash: hashIp(await clientIp()),
    });
    ownerId = r.ownerId;
  } catch (e) {
    return { ok: false, message: userMessage(e) };
  }
  await createSession(db, "owner", ownerId);
  redirect("/owner/dashboard");
}

export async function ownerLogoutAction() {
  await destroySession("owner");
  redirect("/owner");
}

export async function setupBeginAction(_p: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const db = await getDb();
  const ip = hashIp(await clientIp());
  if (!(await rateLimit(db, `owner-setup:${ip}`, 8, 3600))) return { ok: false, message: "محاولات كثيرة، حاول لاحقاً" };
  if (await ownerExists(db)) return { ok: false, message: "تم إعداد حساب المالك مسبقاً" };
  if (!checkSetupToken(String(fd.get("setupToken") || ""))) return { ok: false, message: "رمز الإعداد غير صحيح أو غير مفعّل على الخادم (OWNER_SETUP_TOKEN)" };
  if (String(fd.get("password")) !== String(fd.get("password2"))) return { ok: false, message: "كلمتا المرور غير متطابقتين" };
  try {
    const r = await beginOwnerSetup(db, String(fd.get("username") || ""), String(fd.get("password") || ""));
    const qr = await QRCode.toString(r.otpauth, { type: "svg", margin: 1 });
    return { ok: true, message: "امسح الرمز بتطبيق المصادقة ثم أدخل الرمز المكون من 6 أرقام", data: { ownerId: r.ownerId, secret: r.secret, qr } };
  } catch (e) {
    return { ok: false, message: userMessage(e) };
  }
}

export async function setupCompleteAction(_p: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const db = await getDb();
  if (!checkSetupToken(String(fd.get("setupToken") || ""))) return { ok: false, message: "رمز الإعداد غير صحيح" };
  try {
    await completeOwnerSetup(db, String(fd.get("ownerId") || ""), String(fd.get("code") || ""));
  } catch (e) {
    return { ok: false, message: userMessage(e) };
  }
  redirect("/owner?ready=1");
}

"use server";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { resolveCustomerToken } from "@/lib/services/orders";
import { createSession, destroySession } from "@/lib/security/sessions";
import { rateLimit } from "@/lib/security/rateLimit";
import { clientIp } from "@/lib/security/request";
import { hashIp } from "@/lib/security/crypto";
import { audit } from "@/lib/security/audit";
import type { ActionResult } from "@/components/ui/ActionForm";

export async function redeemCustomerToken(_p: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const db = await getDb();
  const ip = hashIp(await clientIp());
  if (!(await rateLimit(db, `redeem-c:${ip}`, 10, 900))) return { ok: false, message: "محاولات كثيرة، يرجى المحاولة بعد 15 دقيقة" };
  const r = await resolveCustomerToken(db, String(fd.get("token") || ""));
  if ("error" in r) return { ok: false, message: r.error };
  await createSession(db, "customer", r.workspaceId);
  await audit(db, { actorType: "customer", actorId: r.workspaceId, action: "customer.login", ipHash: ip });
  redirect("/dashboard");
}

export async function logoutCustomer() {
  await destroySession("customer");
  redirect("/access?bye=1");
}

import "server-only";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getDb, type Db } from "@/lib/db";
import { getSession } from "@/lib/security/sessions";
import { ownerIsValid } from "@/lib/services/owner";
import { getAffiliate, type AffiliateRow } from "@/lib/services/affiliates";
import { getWorkspace, type WorkspaceInfo } from "@/lib/services/workspace";
import { hashSecret } from "@/lib/security/tokens";

/**
 * Role guards — used by EVERY page and EVERY server action of a role area. Server actions are
 * public HTTP endpoints, so hiding a button is never considered protection.
 */
export async function requireOwner(): Promise<{ db: Db; ownerId: string; username: string }> {
  const s = await getSession("owner");
  if (!s) redirect("/owner");
  const db = await getDb();
  const o = await ownerIsValid(db, s.subjectId);
  if (!o) redirect("/owner");
  return { db, ownerId: s.subjectId, username: o.username };
}

export async function requireAffiliate(): Promise<{ db: Db; affiliate: AffiliateRow }> {
  const s = await getSession("affiliate");
  if (!s) redirect("/affiliate");
  const db = await getDb();
  const a = await getAffiliate(db, s.subjectId);
  if (!a || a.status !== "active") redirect("/affiliate?disabled=1");
  return { db, affiliate: a };
}

export async function requireCustomer(): Promise<{ db: Db; ws: WorkspaceInfo }> {
  const s = await getSession("customer");
  if (!s) redirect("/access");
  const db = await getDb();
  const ws = await getWorkspace(db, s.subjectId);
  if (!ws) redirect("/access");
  if (ws.workspaceStatus !== "active") redirect("/access?suspended=1");
  if (new Date(ws.accessExpiresAt).getTime() < Date.now()) redirect("/access?expired=1");
  return { db, ws };
}

/** Anonymous first-party visitor id (for referral attribution only). Stored hashed server-side. */
export const VISITOR_COOKIE = "dw_vid";
export async function visitorHash(): Promise<string | null> {
  const v = (await cookies()).get(VISITOR_COOKIE)?.value;
  if (!v || !/^[A-Za-z0-9_-]{22}$/.test(v)) return null;
  return hashSecret("v:" + v);
}

export const REF_COOKIE = "dw_ref";

import "server-only";
import { cookies } from "next/headers";
import { getDb, type Queryable } from "@/lib/db";
import { hashSessionId, newCsrfToken, newSessionId } from "./tokens";
import { hashIp } from "./crypto";
import { clientIp, userAgent } from "./request";

/**
 * Server-side sessions, one cookie per role so roles can never be confused:
 *   owner → dw_os (SameSite=Strict, 8 h absolute, 2 h idle)
 *   affiliate → dw_as (Lax, 14 days)
 *   customer → dw_cs (Lax, 30 days)
 * Cookies are HttpOnly (+Secure in production) and hold only a random id; the DB stores its hash.
 * Bearer secrets (customer / affiliate tokens) are exchanged for these sessions and never kept in
 * localStorage or URLs.
 */
export type Role = "owner" | "affiliate" | "customer";

const COOKIE: Record<Role, string> = { owner: "dw_os", affiliate: "dw_as", customer: "dw_cs" };
const TTL_SEC: Record<Role, number> = { owner: 8 * 3600, affiliate: 14 * 86400, customer: 30 * 86400 };
const IDLE_SEC: Record<Role, number> = { owner: 2 * 3600, affiliate: 14 * 86400, customer: 30 * 86400 };

export function secureCookies(): boolean {
  return process.env.NODE_ENV === "production" && process.env.INSECURE_COOKIES !== "1";
}

export interface Session {
  role: Role;
  subjectId: string;
  csrf: string;
  idHash: string;
}

export async function createSession(q: Queryable, role: Role, subjectId: string): Promise<void> {
  const { raw, hash } = newSessionId();
  const ip = hashIp(await clientIp());
  await q.query(
    `insert into sessions(id_hash, role, subject_id, csrf_token, expires_at, ip_hash, user_agent)
     values ($1,$2,$3,$4, now() + make_interval(secs => $5::int), $6, $7)`,
    [hash, role, subjectId, newCsrfToken(), TTL_SEC[role], ip, await userAgent()],
  );
  const jar = await cookies();
  jar.set(COOKIE[role], raw, {
    httpOnly: true,
    secure: secureCookies(),
    sameSite: role === "owner" ? "strict" : "lax",
    path: "/",
    maxAge: TTL_SEC[role],
  });
}

export async function getSession(role: Role): Promise<Session | null> {
  const jar = await cookies();
  const raw = jar.get(COOKIE[role])?.value;
  if (!raw) return null;
  const idHash = hashSessionId(raw);
  if (!idHash) return null;
  const db = await getDb();
  const r = await db.query<{ subject_id: string; csrf_token: string; idle: boolean; touch: boolean }>(
    `select subject_id, csrf_token,
            last_seen_at < now() - make_interval(secs => $3::int) as idle,
            last_seen_at < now() - interval '5 minutes' as touch
       from sessions
      where id_hash = $1 and role = $2 and revoked_at is null and expires_at > now()`,
    [idHash, role, IDLE_SEC[role]],
  );
  const s = r.rows[0];
  if (!s || s.idle) return null;
  if (s.touch) await db.query(`update sessions set last_seen_at = now() where id_hash = $1`, [idHash]);
  return { role, subjectId: s.subject_id, csrf: s.csrf_token, idHash };
}

export async function destroySession(role: Role): Promise<void> {
  const jar = await cookies();
  const raw = jar.get(COOKIE[role])?.value;
  if (raw) {
    const h = hashSessionId(raw);
    if (h) {
      const db = await getDb();
      await db.query(`update sessions set revoked_at = now() where id_hash = $1`, [h]);
    }
  }
  jar.delete(COOKIE[role]);
}

export async function revokeSubjectSessions(q: Queryable, role: Role, subjectId: string): Promise<void> {
  await q.query(`update sessions set revoked_at = now() where role = $1 and subject_id = $2 and revoked_at is null`, [role, subjectId]);
}

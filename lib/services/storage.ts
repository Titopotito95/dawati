import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { randomId } from "@/lib/security/tokens";
import { getDb } from "@/lib/db";

/**
 * Media storage adapter.
 *  - "db" (default): bytes stored in the media_blobs table — works on serverless hosting with no
 *    extra service to configure.
 *  - "local": files under .data/uploads — a single server with a persistent disk.
 *  - "supabase": Supabase Storage via its REST API with the service-role key (server only).
 *    Configure SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_STORAGE_BUCKET (private bucket).
 *    NOTE: the Supabase adapter is written against the documented REST API but has not been run
 *    against a live project from this workspace.
 * Files are always served through /api/media/<key>, keys are 128-bit random and never guessable.
 */
export interface StoredObject {
  body: Buffer;
  mime: string;
}

const LOCAL_DIR = path.join(process.cwd(), ".data", "uploads");
const KEY_RE = /^[A-Za-z0-9_-]{22}\.(webp|mp3|m4a)$/;

function driver(): "db" | "local" | "supabase" {
  const d = process.env.STORAGE_DRIVER;
  return d === "supabase" ? "supabase" : d === "local" ? "local" : "db";
}

export function newMediaKey(ext: "webp" | "mp3" | "m4a"): string {
  return `${randomId(16)}.${ext}`;
}

export function isMediaKey(k: string): boolean {
  return KEY_RE.test(k);
}

export async function putObject(key: string, body: Buffer, mime: string): Promise<void> {
  if (!isMediaKey(key)) throw new Error("bad key");
  if (driver() === "db") {
    const db = await getDb();
    await db.query(`insert into media_blobs (key, mime, body) values ($1, $2, $3)`, [key, mime, new Uint8Array(body)]);
    return;
  }
  if (driver() === "local") {
    await fs.mkdir(LOCAL_DIR, { recursive: true });
    await fs.writeFile(path.join(LOCAL_DIR, key), body);
    await fs.writeFile(path.join(LOCAL_DIR, key + ".type"), mime);
    return;
  }
  const { url, keyHeader, bucket } = supabaseCfg();
  const res = await fetch(`${url}/storage/v1/object/${bucket}/${key}`, {
    method: "POST",
    headers: { authorization: `Bearer ${keyHeader}`, "content-type": mime, "x-upsert": "false" },
    body: new Uint8Array(body),
  });
  if (!res.ok) throw new Error(`storage upload failed: ${res.status}`);
}

export async function getObject(key: string): Promise<StoredObject | null> {
  if (!isMediaKey(key)) return null;
  if (driver() === "db") {
    const db = await getDb();
    const r = await db.query<{ mime: string; body: Uint8Array }>(`select mime, body from media_blobs where key = $1`, [key]);
    return r.rows[0] ? { body: Buffer.from(r.rows[0].body), mime: r.rows[0].mime } : null;
  }
  if (driver() === "local") {
    try {
      const body = await fs.readFile(path.join(LOCAL_DIR, key));
      const mime = await fs.readFile(path.join(LOCAL_DIR, key + ".type"), "utf8").catch(() => "application/octet-stream");
      return { body, mime };
    } catch {
      return null;
    }
  }
  const { url, keyHeader, bucket } = supabaseCfg();
  const res = await fetch(`${url}/storage/v1/object/${bucket}/${key}`, { headers: { authorization: `Bearer ${keyHeader}` } });
  if (!res.ok) return null;
  return { body: Buffer.from(await res.arrayBuffer()), mime: res.headers.get("content-type") || "application/octet-stream" };
}

export async function deleteObject(key: string): Promise<void> {
  if (!isMediaKey(key)) return;
  if (driver() === "db") {
    const db = await getDb();
    await db.query(`delete from media_blobs where key = $1`, [key]);
    return;
  }
  if (driver() === "local") {
    await fs.rm(path.join(LOCAL_DIR, key), { force: true });
    await fs.rm(path.join(LOCAL_DIR, key + ".type"), { force: true });
    return;
  }
  const { url, keyHeader, bucket } = supabaseCfg();
  await fetch(`${url}/storage/v1/object/${bucket}`, {
    method: "DELETE",
    headers: { authorization: `Bearer ${keyHeader}`, "content-type": "application/json" },
    body: JSON.stringify({ prefixes: [key] }),
  });
}

function supabaseCfg() {
  const url = process.env.SUPABASE_URL;
  const keyHeader = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "invitation-media";
  if (!url || !keyHeader) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for STORAGE_DRIVER=supabase");
  return { url: url.replace(/\/$/, ""), keyHeader, bucket };
}

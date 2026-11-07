import "server-only";
import type { Queryable } from "@/lib/db";

export type ActorType = "owner" | "affiliate" | "customer" | "guest" | "system";

/** Append-only audit trail for privileged and security-relevant actions. Raw secrets are never written here. */
export async function audit(
  q: Queryable,
  e: {
    actorType: ActorType;
    actorId?: string;
    action: string;
    targetType?: string;
    targetId?: string;
    details?: Record<string, unknown>;
    ipHash?: string;
  },
) {
  await q.query(
    `insert into audit_logs(actor_type, actor_id, action, target_type, target_id, details, ip_hash) values ($1,$2,$3,$4,$5,$6,$7)`,
    [e.actorType, e.actorId ?? "", e.action, e.targetType ?? "", e.targetId ?? "", JSON.stringify(e.details ?? {}), e.ipHash ?? ""],
  );
}

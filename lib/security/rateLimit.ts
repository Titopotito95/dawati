import "server-only";
import type { Queryable } from "@/lib/db";

/**
 * Fixed-window limiter stored in Postgres so it works across serverless instances.
 * Returns true when the action is allowed.
 */
export async function rateLimit(q: Queryable, key: string, limit: number, windowSec: number): Promise<boolean> {
  const r = await q.query<{ count: number }>(
    `insert into rate_limits(key, window_start, count) values ($1, now(), 1)
     on conflict (key) do update set
       count = case when rate_limits.window_start < now() - make_interval(secs => $2::int) then 1 else rate_limits.count + 1 end,
       window_start = case when rate_limits.window_start < now() - make_interval(secs => $2::int) then now() else rate_limits.window_start end
     returning count`,
    [key, windowSec],
  );
  return (r.rows[0]?.count ?? 0) <= limit;
}

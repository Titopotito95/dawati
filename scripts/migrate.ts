/** Applies pending migrations (they also run automatically on first database use). */
import { getDb } from "@/lib/db";

getDb()
  .then(async (db) => {
    const r = await db.query<{ id: string }>("select id from schema_migrations order by id");
    console.log(`✓ database ready (${db.kind}); applied: ${r.rows.map((x) => x.id).join(", ")}`);
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });

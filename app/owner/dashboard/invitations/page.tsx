import { requireOwner } from "@/lib/auth";
import { formatDateTimeAr, formatEventDate } from "@/lib/invitation/format";
import { EVENT_TYPE_LABELS, type InvitationContent } from "@/lib/invitation/types";
import { num } from "@/lib/db";

export default async function InvitationsPage() {
  const { db } = await requireOwner();
  const r = await db.query<Record<string, unknown>>(`
    select i.id, i.content, i.color_variant_key, i.status, i.guest_limit, i.updated_at, t.name_ar, tv.version, o.reference, o.customer_name,
           (select count(*)::int from guests g where g.invitation_id = i.id and g.deleted_at is null) as guests,
           (select count(*)::int from guest_links gl where gl.invitation_id = i.id and gl.revoked_at is null and gl.expires_at > now()) as live_links,
           (select count(*)::int from guest_links gl where gl.invitation_id = i.id and gl.first_opened_at is not null) as opened,
           (select count(*)::int from rsvp_responses r where r.invitation_id = i.id and r.status = 'accepted') as yes,
           (select count(*)::int from rsvp_responses r where r.invitation_id = i.id and r.status = 'declined') as no
      from invitations i join theme_versions tv on tv.id = i.theme_version_id join themes t on t.id = tv.theme_id
      join customer_workspaces w on w.id = i.workspace_id join orders o on o.id = w.order_id
     order by i.updated_at desc limit 300`);
  return (
    <div className="card overflow-x-auto">
      {r.rows.length === 0 ? (
        <p className="p-8 text-center text-ink-soft">لا توجد دعوات بعد.</p>
      ) : (
        <table className="table">
          <thead><tr><th>العميل</th><th>المناسبة</th><th>الموعد</th><th>التصميم</th><th>المدعوون</th><th>روابط فعالة</th><th>فُتحت</th><th>سيحضر / اعتذر</th><th>الحالة</th><th>آخر تعديل</th></tr></thead>
          <tbody>
            {r.rows.map((x) => {
              const c = x.content as InvitationContent;
              const d = formatEventDate(c.eventDate);
              return (
                <tr key={x.id as string}>
                  <td>{x.customer_name as string}<div className="mono text-xs text-ink-soft">{x.reference as string}</div></td>
                  <td>{EVENT_TYPE_LABELS[c.eventType] ?? "—"}<div className="text-xs text-ink-soft">{c.eventType === "party" || c.eventType === "other" ? c.eventTitle : `${c.groomName} و${c.brideName}`}</div></td>
                  <td>{d ? d.full : "—"}</td>
                  <td>{x.name_ar as string} <span className="text-xs text-ink-soft">v{num(x.version)} · {x.color_variant_key as string}</span></td>
                  <td className="num">{num(x.guests)}/{num(x.guest_limit)}</td>
                  <td className="num">{num(x.live_links)}</td>
                  <td className="num">{num(x.opened)}</td>
                  <td><span className="num text-success">{num(x.yes)}</span> / <span className="num text-danger">{num(x.no)}</span></td>
                  <td><span className={x.status === "active" ? "badge badge-green" : "badge badge-red"}>{x.status === "active" ? "نشطة" : "موقوفة"}</span></td>
                  <td className="text-xs">{formatDateTimeAr(x.updated_at as Date)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      <p className="p-4 text-xs text-ink-soft">لإيقاف دعوة أو تمديدها استخدم صفحة «العملاء». أسماء الضيوف وروابطهم لا تُعرض هنا لحماية خصوصيتهم.</p>
    </div>
  );
}

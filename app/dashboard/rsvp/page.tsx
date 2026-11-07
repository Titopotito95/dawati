import { headers } from "next/headers";
import { requireCustomer } from "@/lib/auth";
import { listGuests, rsvpStats } from "@/lib/services/guests";
import { publicBaseUrl } from "@/lib/security/request";
import Stat from "@/components/ui/Stat";
import { formatDateTimeAr } from "@/lib/invitation/format";

export default async function RsvpPage() {
  const { db, ws } = await requireCustomer();
  const [s, guests] = await Promise.all([rsvpStats(db, ws.invitationId), listGuests(db, ws.invitationId, publicBaseUrl(await headers()))]);
  const groups = [
    { key: "accepted", title: "المؤكد حضورهم", list: guests.filter((g) => g.rsvp === "accepted") },
    { key: "declined", title: "المعتذرون", list: guests.filter((g) => g.rsvp === "declined") },
    { key: "awaiting", title: "في انتظار الرد", list: guests.filter((g) => !g.rsvp) },
  ];
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="إجمالي المدعوين" value={<span className="num">{s.total}</span>} />
        <Stat label="المؤكد حضورهم" value={<span className="num">{s.accepted}</span>} hint={`عدد الأشخاص: ${s.attendees}`} tone="green" />
        <Stat label="المعتذرون" value={<span className="num">{s.declined}</span>} tone="red" />
        <Stat label="في انتظار الرد" value={<span className="num">{s.awaiting}</span>} tone="gold" />
      </div>
      <p className="text-sm text-ink-soft">ملاحظة: فتح الضيف للدعوة لا يعني تأكيد حضوره؛ يُحتسب الحضور فقط عندما يختار «سأحضر بإذن الله».</p>
      <div className="grid gap-4 lg:grid-cols-3">
        {groups.map((gr) => (
          <section key={gr.key} className="card p-4">
            <h2 className="font-semibold">{gr.title} <span className="text-ink-soft">({gr.list.length})</span></h2>
            {gr.list.length === 0 ? (
              <p className="mt-3 text-sm text-ink-soft">لا يوجد</p>
            ) : (
              <ul className="mt-3 divide-y divide-rose/10 text-sm">
                {gr.list.map((g) => (
                  <li key={g.id} className="flex items-center justify-between gap-2 py-2">
                    <span>{g.name}</span>
                    <span className="text-xs text-ink-soft">
                      {g.rsvp === "accepted" ? `${g.partySize} شخص` : null}
                      {g.respondedAt ? ` · ${formatDateTimeAr(g.respondedAt)}` : g.openedAt ? " · فتح الدعوة" : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}

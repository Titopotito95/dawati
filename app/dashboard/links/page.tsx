import { headers } from "next/headers";
import Link from "next/link";
import { requireCustomer } from "@/lib/auth";
import { listGuests } from "@/lib/services/guests";
import { getSettings } from "@/lib/services/settings";
import { publicBaseUrl } from "@/lib/security/request";
import { EVENT_TYPE_LABELS } from "@/lib/invitation/types";
import LinksTable from "./LinksTable";

export default async function LinksPage() {
  const { db, ws } = await requireCustomer();
  const [guests, settings] = await Promise.all([listGuests(db, ws.invitationId, publicBaseUrl(await headers())), getSettings(db)]);
  const couple = ws.content.eventType === "party" || ws.content.eventType === "other" ? ws.content.eventTitle : `${ws.content.groomName} و${ws.content.brideName}`;
  return (
    <div className="space-y-4">
      <div className="card p-5 text-sm leading-7 text-ink-soft">
        <p>
          لكل ضيف رابط خاص يظهر فيه اسمه، صالح لمدة <b>{settings.guestLinkDays} أيام</b> من تاريخ إنشائه. الرابط لا يحتوي على اسم الضيف.
        </p>
        <p>
          <b>تجديد الرابط</b> يُنشئ رابطاً جديداً بصلاحية {settings.guestLinkDays} أيام ويُلغي الرابط القديم فوراً، ويبقى ردّ الضيف محفوظاً. <b>إلغاء الرابط</b> يوقفه دون إنشاء بديل.
        </p>
        <p>تنبيه: من يملك الرابط يستطيع فتحه، فأرسله للضيف نفسه فقط.</p>
      </div>
      {guests.length === 0 ? (
        <p className="card p-8 text-center text-ink-soft">
          لا توجد روابط بعد. <Link href="/dashboard/guests" className="text-burgundy">أضف ضيوفك أولاً</Link>
        </p>
      ) : (
        <LinksTable
          rows={guests.map((g) => ({ id: g.id, name: g.name, state: g.linkState, url: g.linkUrl, expiresAt: g.linkExpiresAt, openedAt: g.openedAt, openCount: g.openCount }))}
          eventLabel={`${EVENT_TYPE_LABELS[ws.content.eventType]} ${couple}`.trim()}
        />
      )}
    </div>
  );
}

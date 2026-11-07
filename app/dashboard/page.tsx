import Link from "next/link";
import { requireCustomer } from "@/lib/auth";
import { rsvpStats } from "@/lib/services/guests";
import Stat from "@/components/ui/Stat";
import { formatDateTimeAr, formatEventDate } from "@/lib/invitation/format";
import { EVENT_TYPE_LABELS } from "@/lib/invitation/types";

export default async function DashboardHome() {
  const { db, ws } = await requireCustomer();
  const s = await rsvpStats(db, ws.invitationId);
  const date = formatEventDate(ws.content.eventDate);
  const left = Math.max(0, ws.guestLimit - s.total);
  const needsSetup = ws.content.groomName === "اسم العريس" || !ws.content.eventDate;
  return (
    <div className="space-y-6">
      {needsSetup ? (
        <div className="card border-gold/40 bg-[#fffaf2] p-5">
          <p className="font-semibold">تهانينا! دعوتك جاهزة للتخصيص</p>
          <p className="mt-1 text-sm leading-7 text-ink-soft">ابدأ بكتابة الأسماء والموعد والمكان، ثم أضف ضيوفك وأرسل لكل منهم رابطه الخاص.</p>
          <Link href="/dashboard/edit" className="btn btn-primary btn-sm mt-3">ابدأ تعديل الدعوة</Link>
        </div>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="إجمالي المدعوين" value={<span className="num">{s.total}</span>} hint={`من أصل ${ws.guestLimit} في باقتك — متبقٍ ${left}`} />
        <Stat label="المؤكد حضورهم" value={<span className="num">{s.accepted}</span>} hint={`إجمالي الحضور المتوقع: ${s.attendees}`} tone="green" />
        <Stat label="المعتذرون" value={<span className="num">{s.declined}</span>} tone="red" />
        <Stat label="في انتظار الرد" value={<span className="num">{s.awaiting}</span>} hint={`فتحوا الدعوة: ${s.opened}`} tone="gold" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <p className="text-sm text-ink-soft">دعوتك</p>
          <p className="mt-1 font-[family-name:var(--font-display)] text-xl font-semibold">{ws.themeName}</p>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-ink-soft">المناسبة</dt><dd>{EVENT_TYPE_LABELS[ws.content.eventType]}</dd></div>
            <div><dt className="text-ink-soft">الموعد</dt><dd>{date ? date.full : "لم يحدد بعد"}</dd></div>
            <div><dt className="text-ink-soft">رقم الطلب</dt><dd className="mono">{ws.orderReference}</dd></div>
            <div><dt className="text-ink-soft">صلاحية الوصول حتى</dt><dd>{formatDateTimeAr(ws.accessExpiresAt)}</dd></div>
          </dl>
        </div>
        <div className="card p-5">
          <p className="font-semibold">خطوات سريعة</p>
          <ol className="mt-3 space-y-2 text-sm">
            <li><Link className="text-burgundy hover:underline" href="/dashboard/edit">1. اكتب تفاصيل الدعوة</Link></li>
            <li><Link className="text-burgundy hover:underline" href="/dashboard/design">2. اختر اللون والصفحات والصور</Link></li>
            <li><Link className="text-burgundy hover:underline" href="/dashboard/guests">3. أضف أسماء المدعوين</Link></li>
            <li><Link className="text-burgundy hover:underline" href="/dashboard/links">4. أرسل الروابط عبر واتساب</Link></li>
            <li><Link className="text-burgundy hover:underline" href="/dashboard/rsvp">5. تابع تأكيد الحضور</Link></li>
          </ol>
        </div>
      </div>
    </div>
  );
}

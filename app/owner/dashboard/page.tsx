import Link from "next/link";
import { requireOwner } from "@/lib/auth";
import { overviewStats } from "@/lib/services/owner";
import Stat from "@/components/ui/Stat";
import RevenueChart from "@/components/dashboard/RevenueChart";
import { formatMoney } from "@/lib/money";

export default async function OwnerOverview() {
  const { db } = await requireOwner();
  const s = await overviewStats(db);
  const cur = "LYD";
  const fmtDay = (d: string) => new Intl.DateTimeFormat("ar-LY", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(d + "T12:00:00Z"));
  const format: Record<string, string> = Object.fromEntries(s.series.map((x) => [x.date, formatMoney(x.amountMinor, cur)]));
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <Link href="/owner/dashboard/orders#issue" className="btn btn-primary">إصدار رمز لعميل جديد</Link>
        <Link href="/owner/dashboard/affiliates" className="btn btn-outline">المسوقون</Link>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="صافي الإيرادات" value={formatMoney(s.netMinor, cur)} hint={`الإجمالي ${formatMoney(s.grossMinor, cur)} — المسترجع ${formatMoney(s.refundedMinor, cur)}`} />
        <Stat label="اليوم" value={formatMoney(s.todayMinor, cur)} hint={`آخر 7 أيام: ${formatMoney(s.weekMinor, cur)}`} />
        <Stat label="هذا الشهر" value={formatMoney(s.monthMinor, cur)} hint={`طلبات الشهر: ${s.ordersMonth}`} />
        <Stat label="الطلبات المدفوعة" value={<span className="num">{s.ordersPaid}</span>} hint={`عبر المسوقين: ${s.affiliateOrders} — استرجاعات: ${s.refundsCount}`} />
        <Stat label="الدعوات النشطة" value={<span className="num">{s.activeWorkspaces}</span>} />
        <Stat label="إجمالي المدعوين" value={<span className="num">{s.guests}</span>} hint={`سيحضرون ${s.rsvpYes} — اعتذروا ${s.rsvpNo}`} />
        <Stat label="عمولات مستحقة (غير مدفوعة)" value={formatMoney(s.commissionOwedMinor, cur)} tone="gold" />
        <Stat label="نقد لدى المسوقين" value={formatMoney(s.cashWithAffiliatesMinor, cur)} tone="red" hint="مبالغ حصّلها المسوقون ولم تُسلَّم بعد" />
      </div>
      <section className="card p-5">
        <h2 className="mb-3 font-semibold">الإيرادات اليومية — آخر 30 يوماً</h2>
        <RevenueChart series={s.series.map((x) => ({ ...x, label: fmtDay(x.date) }))} format={format} />
      </section>
      <section className="card p-5">
        <h2 className="font-semibold">التصاميم الأكثر طلباً</h2>
        {s.popular.length === 0 ? (
          <p className="mt-2 text-sm text-ink-soft">لا توجد مبيعات بعد.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {s.popular.map((p) => (
              <li key={p.name} className="flex justify-between"><span>{p.name}</span><span className="num">{p.count}</span></li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

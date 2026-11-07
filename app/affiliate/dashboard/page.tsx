import Link from "next/link";
import { requireAffiliate } from "@/lib/auth";
import { affiliateSummary, affiliateOrders } from "@/lib/services/affiliates";
import Stat from "@/components/ui/Stat";
import { formatMoney, formatRate } from "@/lib/money";
import { formatDateTimeAr } from "@/lib/invitation/format";
import { COMMISSION_STATUS_AR } from "@/lib/services/commissions";

export default async function AffiliateHome() {
  const { db, affiliate } = await requireAffiliate();
  const [s, recent] = await Promise.all([affiliateSummary(db, affiliate.id), affiliateOrders(db, affiliate.id, 8)]);
  const cur = recent[0]?.currency ?? "LYD";
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="المبيعات المنسوبة إليك" value={<span className="num">{s.paidOrders}</span>} hint={`نسبة عمولتك الحالية ${formatRate(affiliate.rateBps)}`} />
        <Stat label="قيمة المبيعات المؤهلة" value={formatMoney(s.eligibleMinor, cur)} />
        <Stat label="عمولات قيد الانتظار" value={formatMoney(s.pendingMinor, cur)} tone="gold" />
        <Stat label="عمولات معتمدة (مستحقة)" value={formatMoney(s.approvedMinor, cur)} tone="green" hint={`مدفوعة حتى الآن: ${formatMoney(s.paidMinor, cur)}`} />
      </div>
      <div className="card p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">آخر المبيعات</h2>
          <Link href="/affiliate/dashboard/sales" className="text-sm text-burgundy">عرض الكل</Link>
        </div>
        {recent.length === 0 ? (
          <p className="mt-4 text-sm text-ink-soft">لا توجد مبيعات بعد. شارك رابط الإحالة الخاص بك{affiliate.canIssueTokens ? " أو أصدر رمزاً لعميل بعد استلام المبلغ" : ""}.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="table">
              <thead><tr><th>رقم الطلب</th><th>التاريخ</th><th>التصميم</th><th>المبلغ</th><th>عمولتك</th><th>الحالة</th></tr></thead>
              <tbody>
                {recent.map((o) => (
                  <tr key={o.reference}>
                    <td className="mono">{o.reference}</td>
                    <td>{formatDateTimeAr(o.createdAt)}</td>
                    <td>{o.themeName}</td>
                    <td>{formatMoney(o.amountMinor, o.currency)}</td>
                    <td>{formatMoney(o.commissionMinor, o.currency)}</td>
                    <td><span className="badge">{o.commissionStatus ? COMMISSION_STATUS_AR[o.commissionStatus] : o.statusAr}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p className="text-xs leading-6 text-ink-soft">
        العمولة {formatRate(affiliate.rateBps)} من المبلغ المحصّل فعلياً لكل بيع مكتمل. تصبح «معتمدة» بعد مراجعة الإدارة، و«مدفوعة» عند تسليمها لك. الاسترجاع يلغي العمولة أو يخصمها.
      </p>
    </div>
  );
}

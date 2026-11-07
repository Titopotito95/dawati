import { requireAffiliate } from "@/lib/auth";
import { affiliateOrders } from "@/lib/services/affiliates";
import { formatMoney } from "@/lib/money";
import { formatDateTimeAr } from "@/lib/invitation/format";
import { COMMISSION_STATUS_AR } from "@/lib/services/commissions";

const SRC: Record<string, string> = { issued_by_affiliate: "أصدرته بنفسك", assigned_by_owner: "سجّلته الإدارة باسمك" };

export default async function SalesPage() {
  const { db, affiliate } = await requireAffiliate();
  const rows = await affiliateOrders(db, affiliate.id, 500);
  return (
    <div className="card overflow-x-auto">
      {rows.length === 0 ? (
        <p className="p-8 text-center text-ink-soft">لا توجد مبيعات بعد.</p>
      ) : (
        <table className="table">
          <thead><tr><th>رقم الطلب</th><th>التاريخ</th><th>التصميم</th><th>المدعوون</th><th>المبلغ</th><th>المصدر</th><th>حالة الطلب</th><th>عمولتك</th></tr></thead>
          <tbody>
            {rows.map((o) => (
              <tr key={o.reference}>
                <td className="mono">{o.reference}</td>
                <td>{formatDateTimeAr(o.createdAt)}</td>
                <td>{o.themeName}</td>
                <td className="num">{o.guestLimit}</td>
                <td>{formatMoney(o.amountMinor, o.currency)}</td>
                <td className="text-xs">{SRC[o.source] ?? "—"}</td>
                <td><span className="badge">{o.statusAr}</span></td>
                <td>{formatMoney(o.commissionMinor, o.currency)} {o.commissionStatus ? <span className="badge mr-1">{COMMISSION_STATUS_AR[o.commissionStatus]}</span> : null}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

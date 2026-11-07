import { requireAffiliate } from "@/lib/auth";
import { listCommissions, COMMISSION_STATUS_AR } from "@/lib/services/commissions";
import { affiliateSummary } from "@/lib/services/affiliates";
import Stat from "@/components/ui/Stat";
import { formatMoney, formatRate } from "@/lib/money";
import { formatDateTimeAr } from "@/lib/invitation/format";

export default async function CommissionsPage() {
  const { db, affiliate } = await requireAffiliate();
  const [rows, s] = await Promise.all([listCommissions(db, { affiliateId: affiliate.id }), affiliateSummary(db, affiliate.id)]);
  const cur = rows[0]?.currency ?? "LYD";
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label="قيد الانتظار" value={formatMoney(s.pendingMinor, cur)} tone="gold" />
        <Stat label="معتمدة" value={formatMoney(s.approvedMinor, cur)} tone="green" />
        <Stat label="مدفوعة" value={formatMoney(s.paidMinor, cur)} />
        <Stat label="ملغاة" value={formatMoney(s.reversedMinor, cur)} tone="red" />
      </div>
      <div className="card overflow-x-auto">
        {rows.length === 0 ? (
          <p className="p-8 text-center text-ink-soft">لا توجد عمولات بعد.</p>
        ) : (
          <table className="table">
            <thead><tr><th>رقم الطلب</th><th>النوع</th><th>أساس الحساب</th><th>النسبة</th><th>العمولة</th><th>الحالة</th><th>التاريخ</th></tr></thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id}>
                  <td className="mono">{c.reference}</td>
                  <td>{c.kind === "sale" ? "بيع" : c.reason === "chargeback" ? "خصم (نزاع)" : "خصم (استرجاع)"}</td>
                  <td>{formatMoney(c.basisMinor, c.currency)}</td>
                  <td>{formatRate(c.rateBps)}</td>
                  <td className={c.amountMinor < 0 ? "text-danger" : ""}>{formatMoney(c.amountMinor, c.currency)}</td>
                  <td><span className="badge">{COMMISSION_STATUS_AR[c.status]}</span></td>
                  <td>{formatDateTimeAr(c.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <p className="text-xs leading-6 text-ink-soft">تُحسب كل عمولة بالنسبة السارية وقت البيع وتُحفظ معه؛ تغيير النسبة لاحقاً لا يغيّر العمولات السابقة.</p>
    </div>
  );
}

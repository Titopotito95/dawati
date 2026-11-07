import { requireAffiliate } from "@/lib/auth";
import { affiliatePayouts } from "@/lib/services/affiliates";
import { PAYOUT_METHOD_AR } from "@/lib/services/commissions";
import { formatMoney } from "@/lib/money";

export default async function PayoutsPage() {
  const { db, affiliate } = await requireAffiliate();
  const rows = await affiliatePayouts(db, affiliate.id);
  return (
    <div className="card overflow-x-auto">
      {rows.length === 0 ? (
        <p className="p-8 text-center text-ink-soft">لا توجد دفعات مسجلة بعد.</p>
      ) : (
        <table className="table">
          <thead><tr><th>التاريخ</th><th>المبلغ</th><th>الطريقة</th><th>المرجع</th><th>ملاحظة</th></tr></thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id}>
                <td>{p.paidOn}</td>
                <td className="font-semibold">{formatMoney(p.amountMinor, p.currency)}</td>
                <td>{PAYOUT_METHOD_AR[p.method] ?? p.method}</td>
                <td>{p.reference}</td>
                <td className="text-sm text-ink-soft">{p.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

import { requireOwner } from "@/lib/auth";
import { listCommissions, COMMISSION_STATUS_AR } from "@/lib/services/commissions";
import { formatMoney, formatRate } from "@/lib/money";
import { formatDateTimeAr } from "@/lib/invitation/format";
import ActionForm, { SubmitButton } from "@/components/ui/ActionForm";
import { approveCommissionsAction } from "../actions";

export default async function CommissionsAdmin({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { db } = await requireOwner();
  const sp = await searchParams;
  const status = ["pending", "approved", "paid", "reversed"].includes(sp.status ?? "") ? sp.status : undefined;
  const rows = await listCommissions(db, { status });
  return (
    <div className="space-y-4">
      <nav className="flex flex-wrap gap-2" aria-label="تصفية العمولات">
        {[["", "الكل"], ["pending", "قيد الانتظار"], ["approved", "معتمدة"], ["paid", "مدفوعة"], ["reversed", "ملغاة"]].map(([k, l]) => (
          <a key={k} href={k ? `?status=${k}` : "?"} className={`btn btn-sm ${status === k || (!status && !k) ? "btn-primary" : "btn-outline"}`}>{l}</a>
        ))}
      </nav>
      <ActionForm action={approveCommissionsAction} className="card overflow-x-auto">
        {rows.length === 0 ? (
          <p className="p-8 text-center text-ink-soft">لا توجد عمولات.</p>
        ) : (
          <table className="table">
            <thead><tr><th>اعتماد</th><th>المسوق</th><th>الطلب</th><th>النوع</th><th>الأساس</th><th>النسبة</th><th>العمولة</th><th>الحالة</th><th>التاريخ</th></tr></thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id}>
                  <td>{c.status === "pending" ? <input type="checkbox" name="ids" value={c.id} defaultChecked className="h-5 w-5 accent-burgundy" aria-label="اعتماد" /> : null}</td>
                  <td>{c.affiliateName}</td>
                  <td className="mono">{c.reference}</td>
                  <td>{c.kind === "sale" ? "بيع" : "تسوية"}</td>
                  <td>{formatMoney(c.basisMinor, c.currency)}</td>
                  <td>{formatRate(c.rateBps)}</td>
                  <td className={c.amountMinor < 0 ? "text-danger" : ""}>{formatMoney(c.amountMinor, c.currency)}</td>
                  <td><span className="badge">{COMMISSION_STATUS_AR[c.status]}</span></td>
                  <td className="text-xs">{formatDateTimeAr(c.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {rows.some((c) => c.status === "pending") ? (
          <div className="border-t border-rose/10 p-4">
            <SubmitButton className="btn btn-primary btn-sm">اعتماد العمولات المحددة</SubmitButton>
            <p className="hint">الاعتماد يعني أن البيع مؤكد وأن العمولة مستحقة للدفع. الدفع نفسه يُسجَّل من صفحة «المدفوعات».</p>
          </div>
        ) : null}
      </ActionForm>
    </div>
  );
}

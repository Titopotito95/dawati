import { requireOwner } from "@/lib/auth";
import { formatMoney } from "@/lib/money";
import { formatDateTimeAr } from "@/lib/invitation/format";
import { PAYOUT_METHOD_AR } from "@/lib/services/commissions";
import ActionForm, { SubmitButton } from "@/components/ui/ActionForm";
import { recordPayoutAction, remittedAction } from "../actions";
import { num } from "@/lib/db";

export default async function PaymentsAdmin() {
  const { db } = await requireOwner();
  const [payments, refunds, owed, payouts] = await Promise.all([
    db.query<Record<string, unknown>>(`select p.*, o.reference, o.customer_name, a.name as aff_name from payments p join orders o on o.id = p.order_id left join affiliates a on a.id = p.received_by_id and p.received_by_type = 'affiliate' order by p.received_at desc limit 300`),
    db.query<Record<string, unknown>>(`select r.*, o.reference from refunds r join orders o on o.id = r.order_id order by r.created_at desc limit 200`),
    db.query<Record<string, unknown>>(`select a.id, a.name, a.referral_code, sum(c.amount_minor)::bigint as approved, count(*)::int as n, min(c.currency) as currency
                                         from commission_records c join affiliates a on a.id = c.affiliate_id
                                        where c.status = 'approved' and c.payout_id is null group by a.id, a.name, a.referral_code`),
    db.query<Record<string, unknown>>(`select p.*, a.name from commission_payouts p join affiliates a on a.id = p.affiliate_id order by p.paid_on desc, p.created_at desc limit 200`),
  ]);
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div className="space-y-6">
      <section className="card p-5">
        <h2 className="font-semibold">عمولات معتمدة بانتظار الدفع</h2>
        <p className="hint">سجّل هنا دفعة قمت بها فعلاً خارج النظام (نقداً أو تحويل أو خصم من النقد الذي يحمله المسوق). التسجيل لا يحوّل أي أموال.</p>
        {owed.rows.length === 0 ? <p className="mt-3 text-sm text-ink-soft">لا توجد عمولات معتمدة غير مدفوعة.</p> : null}
        <div className="mt-3 space-y-3">
          {owed.rows.map((o) => (
            <ActionForm key={o.id as string} action={recordPayoutAction} className="grid items-end gap-3 rounded-xl border border-rose/20 p-3 sm:grid-cols-2 lg:grid-cols-6" confirm="تأكيد تسجيل هذه الدفعة؟">
              <input type="hidden" name="affiliateId" value={o.id as string} />
              <div className="lg:col-span-1"><p className="font-semibold">{o.name as string}</p><p className="text-sm">{formatMoney(num(o.approved), o.currency as string)} ({num(o.n)} قيد)</p></div>
              <label className="block"><span className="label">الطريقة</span>
                <select name="method" className="field">{Object.entries(PAYOUT_METHOD_AR).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
              </label>
              <label className="block"><span className="label">التاريخ</span><input type="date" name="paidOn" defaultValue={today} className="field" required /></label>
              <label className="block"><span className="label">المرجع *</span><input name="reference" className="field" required placeholder="رقم الإيصال / وصف" maxLength={200} /></label>
              <label className="block"><span className="label">ملاحظة</span><input name="note" className="field" maxLength={300} /></label>
              <SubmitButton className="btn btn-primary btn-sm">تسجيل الدفعة</SubmitButton>
            </ActionForm>
          ))}
        </div>
      </section>

      <section className="card overflow-x-auto p-0">
        <h2 className="p-5 pb-0 font-semibold">المبالغ المستلمة</h2>
        <table className="table mt-3">
          <thead><tr><th>التاريخ</th><th>الطلب</th><th>العميل</th><th>المبلغ</th><th>المستلم</th><th>تسليم النقد</th></tr></thead>
          <tbody>
            {payments.rows.map((p) => (
              <tr key={p.id as string}>
                <td className="text-xs">{formatDateTimeAr(p.received_at as Date)}</td>
                <td className="mono">{p.reference as string}</td>
                <td>{p.customer_name as string}</td>
                <td>{formatMoney(num(p.amount_minor), p.currency as string)}</td>
                <td>{p.received_by_type === "owner" ? "المالك" : `المسوق ${p.aff_name ?? ""}`}</td>
                <td>
                  {p.received_by_type === "owner" ? "—" : p.remitted_at ? (
                    <span className="badge badge-green">تم التسليم {formatDateTimeAr(p.remitted_at as Date)}</span>
                  ) : (
                    <ActionForm action={remittedAction} confirm="تأكيد استلام هذا المبلغ من المسوق؟">
                      <input type="hidden" name="paymentId" value={p.id as string} />
                      <input type="hidden" name="note" value="" />
                      <SubmitButton className="btn btn-outline btn-sm">تم استلام النقد</SubmitButton>
                    </ActionForm>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card overflow-x-auto p-0">
          <h2 className="p-5 pb-0 font-semibold">سجل دفعات العمولات</h2>
          <table className="table mt-3">
            <thead><tr><th>التاريخ</th><th>المسوق</th><th>المبلغ</th><th>الطريقة</th><th>المرجع</th></tr></thead>
            <tbody>
              {payouts.rows.map((p) => (
                <tr key={p.id as string}>
                  <td>{p.paid_on instanceof Date ? (p.paid_on as Date).toISOString().slice(0, 10) : String(p.paid_on)}</td>
                  <td>{p.name as string}</td>
                  <td>{formatMoney(num(p.amount_minor), p.currency as string)}</td>
                  <td>{PAYOUT_METHOD_AR[p.method as string]}</td>
                  <td>{p.reference as string}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section className="card overflow-x-auto p-0">
          <h2 className="p-5 pb-0 font-semibold">الاسترجاعات والنزاعات</h2>
          <table className="table mt-3">
            <thead><tr><th>التاريخ</th><th>الطلب</th><th>النوع</th><th>المبلغ</th><th>السبب</th></tr></thead>
            <tbody>
              {refunds.rows.map((r) => (
                <tr key={r.id as string}>
                  <td className="text-xs">{formatDateTimeAr(r.created_at as Date)}</td>
                  <td className="mono">{r.reference as string}</td>
                  <td>{r.kind === "chargeback" ? "نزاع" : "استرجاع"}</td>
                  <td>{formatMoney(num(r.amount_minor), "LYD")}</td>
                  <td className="text-sm">{r.note as string}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}

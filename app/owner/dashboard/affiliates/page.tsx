import { headers } from "next/headers";
import { requireOwner } from "@/lib/auth";
import { affiliateSummary, type AffiliateRow } from "@/lib/services/affiliates";
import { getSettings } from "@/lib/services/settings";
import { publicBaseUrl } from "@/lib/security/request";
import { formatMoney, formatRate } from "@/lib/money";
import ActionForm, { SubmitButton } from "@/components/ui/ActionForm";
import SecretActionForm from "@/components/ui/SecretActionForm";
import { createAffiliateAction, updateAffiliateAction, reissueAffiliateTokenAction } from "../actions";
import { num } from "@/lib/db";

export default async function AffiliatesAdmin() {
  const { db } = await requireOwner();
  const settings = await getSettings(db);
  const r = await db.query<Record<string, unknown>>(`select * from affiliates order by created_at`);
  const rows: AffiliateRow[] = r.rows.map((x) => ({
    id: x.id as string, name: x.name as string, phone: (x.phone as string) || "", region: (x.region as string) || "", referralCode: x.referral_code as string,
    rateBps: num(x.commission_rate_bps), canIssueTokens: !!x.can_issue_tokens, status: x.status as string, notes: (x.notes as string) || "", createdAt: String(x.created_at),
  }));
  const sums = await Promise.all(rows.map((a) => affiliateSummary(db, a.id)));
  const base = publicBaseUrl(await headers());
  return (
    <div className="space-y-6">
      <section className="card p-5">
        <h2 className="font-semibold">إضافة مسوق</h2>
        <SecretActionForm action={createAffiliateAction} secretTitle="رمز دخول المسوق" filename="رمز-المسوق.txt" className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" resetOnSuccess>
          <label className="block"><span className="label">الاسم *</span><input name="name" className="field" required maxLength={120} /></label>
          <label className="block"><span className="label">رمز الإحالة * (لاتيني)</span><input name="code" className="field mono" dir="ltr" required placeholder="LIBYA001" maxLength={20} /></label>
          <label className="block"><span className="label">نسبة العمولة ٪</span><input name="ratePct" className="field" dir="ltr" defaultValue={settings.defaultCommissionBps / 100} inputMode="decimal" /></label>
          <label className="block"><span className="label">الهاتف (واتساب)</span><input name="phone" className="field" dir="ltr" inputMode="tel" maxLength={30} /></label>
          <label className="block"><span className="label">المنطقة</span><input name="region" className="field" maxLength={60} placeholder="ليبيا" /></label>
          <label className="flex items-center gap-2 self-end pb-3"><input type="checkbox" name="canIssue" className="h-5 w-5 accent-burgundy" /> يمكنه إصدار رموز للعملاء بعد استلام النقد</label>
          <div className="sm:col-span-2 lg:col-span-3"><SubmitButton>إنشاء المسوق وإصدار رمزه</SubmitButton></div>
        </SecretActionForm>
      </section>

      {rows.map((a, i) => {
        const s = sums[i];
        return (
          <section key={a.id} className="card p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{a.name} <span className="mono text-sm text-ink-soft">{a.referralCode}</span></p>
                <p className="mono text-xs text-ink-soft" dir="ltr">{base}/?ref={a.referralCode}</p>
              </div>
              <div className="flex gap-2">
                <span className={a.status === "active" ? "badge badge-green" : "badge badge-red"}>{a.status === "active" ? "نشط" : "موقوف"}</span>
                <span className="badge badge-gold">{formatRate(a.rateBps)}</span>
                {a.canIssueTokens ? <span className="badge badge-burgundy">يصدر الرموز</span> : null}
              </div>
            </div>
            <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3 lg:grid-cols-6">
              <span>المبيعات: <b className="num">{s.paidOrders}</b></span>
              <span>الزيارات: <b className="num">{s.visits}</b></span>
              <span>المؤهلة: {formatMoney(s.eligibleMinor, "LYD")}</span>
              <span>قيد الانتظار: {formatMoney(s.pendingMinor, "LYD")}</span>
              <span>معتمدة: {formatMoney(s.approvedMinor, "LYD")}</span>
              <span>مدفوعة: {formatMoney(s.paidMinor, "LYD")}</span>
            </div>
            <details className="mt-3">
              <summary className="cursor-pointer text-sm font-semibold text-burgundy">تعديل / رمز جديد</summary>
              <div className="mt-3 grid gap-5 lg:grid-cols-[1fr_auto]">
                <ActionForm action={updateAffiliateAction} className="grid gap-3 sm:grid-cols-2">
                  <input type="hidden" name="id" value={a.id} />
                  <label className="block"><span className="label">نسبة العمولة ٪ (للمبيعات الجديدة)</span><input name="ratePct" className="field" dir="ltr" defaultValue={a.rateBps / 100} /></label>
                  <label className="block"><span className="label">الحالة</span><select name="status" defaultValue={a.status} className="field"><option value="active">نشط</option><option value="disabled">موقوف (يلغي رمزه)</option></select></label>
                  <label className="block"><span className="label">الهاتف</span><input name="phone" className="field" dir="ltr" defaultValue={a.phone} /></label>
                  <label className="block"><span className="label">المنطقة</span><input name="region" className="field" defaultValue={a.region} /></label>
                  <label className="block sm:col-span-2"><span className="label">ملاحظات</span><input name="notes" className="field" defaultValue={a.notes} maxLength={500} /></label>
                  <label className="flex items-center gap-2"><input type="checkbox" name="canIssue" defaultChecked={a.canIssueTokens} className="h-5 w-5 accent-burgundy" /> يمكنه إصدار رموز للعملاء</label>
                  <div><SubmitButton className="btn btn-primary btn-sm">حفظ</SubmitButton></div>
                </ActionForm>
                <SecretActionForm action={reissueAffiliateTokenAction} confirm="إصدار رمز جديد للمسوق وإلغاء الرمز الحالي؟" secretTitle="رمز الدخول الجديد للمسوق" filename="رمز-المسوق.txt">
                  <input type="hidden" name="id" value={a.id} />
                  <SubmitButton className="btn btn-outline btn-sm">إصدار رمز دخول جديد</SubmitButton>
                </SecretActionForm>
              </div>
            </details>
          </section>
        );
      })}
    </div>
  );
}

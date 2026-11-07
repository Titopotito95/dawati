import { requireOwner } from "@/lib/auth";
import { listOrders } from "@/lib/services/owner";
import { formatDateTimeAr } from "@/lib/invitation/format";
import ActionForm, { SubmitButton } from "@/components/ui/ActionForm";
import SecretActionForm from "@/components/ui/SecretActionForm";
import { reissueCustomerTokenAction, guestLimitAction, extendAccessAction, workspaceStatusAction } from "../actions";

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { db } = await requireOwner();
  const sp = await searchParams;
  const rows = (await listOrders(db, { search: sp.q })).filter((o) => o.workspaceId);
  const creds = await db.query<{ workspace_id: string; token_hint: string; created_at: Date; last_used_at: Date | null }>(
    `select workspace_id, token_hint, created_at, last_used_at from customer_credentials where revoked_at is null`,
  );
  const credBy = new Map(creds.rows.map((c) => [c.workspace_id, c]));
  return (
    <div className="space-y-4">
      <form className="card flex flex-wrap items-end gap-3 p-4" role="search">
        <label className="block min-w-[220px] flex-1">
          <span className="label">بحث عن عميل</span>
          <input name="q" defaultValue={sp.q} className="field" placeholder="الاسم أو الهاتف أو رقم الطلب" />
        </label>
        <button className="btn btn-outline" type="submit">بحث</button>
      </form>
      <p className="text-sm text-ink-soft">لا تُعرض رموز الدخول هنا أبداً (تُخزَّن مشفرة باتجاه واحد). يظهر فقط آخر 4 أحرف للمطابقة مع العميل.</p>
      {rows.length === 0 ? <p className="card p-8 text-center text-ink-soft">لا يوجد عملاء.</p> : null}
      {rows.map((o) => {
        const c = credBy.get(o.workspaceId!);
        return (
          <article key={o.id} className="card p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{o.customerName} <span className="mono text-sm text-ink-soft">{o.reference}</span></p>
                <p className="text-sm text-ink-soft">{o.customerPhone ? <span className="num">{o.customerPhone}</span> : "بدون هاتف"} — {o.themeName}</p>
              </div>
              <span className={o.workspaceStatus === "active" ? "badge badge-green" : "badge badge-red"}>{o.workspaceStatus === "active" ? "نشطة" : "موقوفة"}</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-soft">
              <span>المدعوون: <span className="num">{o.guestsUsed}/{o.guestLimit}</span></span>
              <span>الوصول حتى: {formatDateTimeAr(o.accessExpiresAt)}</span>
              <span>الرمز الحالي: {c ? <span className="mono">…{c.token_hint}</span> : "لا يوجد"}{c?.last_used_at ? ` (آخر استخدام ${formatDateTimeAr(c.last_used_at)})` : ""}</span>
            </div>
            <details className="mt-3">
              <summary className="cursor-pointer text-sm font-semibold text-burgundy">إدارة</summary>
              <div className="mt-3 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <SecretActionForm action={reissueCustomerTokenAction} confirm="تحقق أولاً من هوية العميل (الاسم والهاتف ورقم الطلب). إصدار رمز بديل وإلغاء الحالي؟" secretTitle="رمز الدخول البديل للعميل" filename={`رمز-${o.reference}.txt`}>
                  <input type="hidden" name="workspaceId" value={o.workspaceId!} />
                  <span className="label">فقد العميل رمزه؟</span>
                  <SubmitButton className="btn btn-outline btn-sm">إصدار رمز بديل</SubmitButton>
                </SecretActionForm>
                <ActionForm action={guestLimitAction} className="space-y-2">
                  <input type="hidden" name="workspaceId" value={o.workspaceId!} />
                  <span className="label">عدد المدعوين المسموح</span>
                  <input name="limit" type="number" min={1} max={5000} defaultValue={o.guestLimit} className="field" />
                  <SubmitButton className="btn btn-outline btn-sm">تحديث</SubmitButton>
                </ActionForm>
                <ActionForm action={extendAccessAction} className="space-y-2">
                  <input type="hidden" name="workspaceId" value={o.workspaceId!} />
                  <span className="label">تمديد الوصول (أيام)</span>
                  <input name="days" type="number" min={1} max={3650} defaultValue={90} className="field" />
                  <SubmitButton className="btn btn-outline btn-sm">تمديد</SubmitButton>
                </ActionForm>
                <ActionForm action={workspaceStatusAction} confirm={o.workspaceStatus === "active" ? "إيقاف الدعوة؟ لن يتمكن العميل ولا الضيوف من فتحها." : "إعادة تفعيل الدعوة؟"}>
                  <input type="hidden" name="workspaceId" value={o.workspaceId!} />
                  <input type="hidden" name="status" value={o.workspaceStatus === "active" ? "suspended" : "active"} />
                  <span className="label">الحالة</span>
                  <SubmitButton className={o.workspaceStatus === "active" ? "btn btn-danger btn-sm" : "btn btn-primary btn-sm"}>{o.workspaceStatus === "active" ? "إيقاف الدعوة" : "إعادة التفعيل"}</SubmitButton>
                </ActionForm>
              </div>
            </details>
          </article>
        );
      })}
    </div>
  );
}

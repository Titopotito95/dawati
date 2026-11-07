import { headers } from "next/headers";
import { requireOwner } from "@/lib/auth";
import { listOrders } from "@/lib/services/owner";
import { listThemes } from "@/lib/services/catalog";
import { getSettings } from "@/lib/services/settings";
import { publicBaseUrl } from "@/lib/security/request";
import { ORDER_STATUS_AR, type OrderStatus } from "@/lib/services/orders";
import { formatMoney, exponent } from "@/lib/money";
import { formatDateTimeAr } from "@/lib/invitation/format";
import IssueTokenForm from "@/components/dashboard/IssueTokenForm";
import ActionForm, { SubmitButton } from "@/components/ui/ActionForm";
import { randomId } from "@/lib/security/tokens";
import { ownerIssueAction, refundAction, addNoteAction } from "../actions";

const SRC: Record<string, string> = { issued_by_affiliate: "أصدره المسوق", assigned_by_owner: "سُجّل للمسوق" };

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const { db } = await requireOwner();
  const sp = await searchParams;
  const [orders, themes, settings, affs] = await Promise.all([
    listOrders(db, { search: sp.q, status: sp.status || undefined }),
    listThemes(db),
    getSettings(db),
    db.query<{ id: string; name: string; referral_code: string }>(`select id, name, referral_code from affiliates where status = 'active' order by name`),
  ]);
  const notes = await db.query<{ order_id: string; body: string; created_at: Date }>(`select order_id, body, created_at from crm_notes order by created_at desc limit 500`);
  const base = publicBaseUrl(await headers());
  return (
    <div className="space-y-6">
      <section id="issue" className="card scroll-mt-24 p-5">
        <h2 className="font-semibold">إصدار رمز لعميل جديد</h2>
        <p className="mb-4 mt-1 text-sm text-ink-soft">بعد استلام المبلغ يداً بيد: سجّل البيع وحدد عدد المدعوين، وسلّم العميل رمز الدخول.</p>
        <IssueTokenForm
          action={ownerIssueAction}
          themes={themes.map((t) => ({ slug: t.slug, nameAr: t.nameAr, priceMajor: String(t.priceMinor / 10 ** exponent(t.currency)), currency: t.currency, variants: t.variants.map((v) => ({ key: v.key, nameAr: v.nameAr })) }))}
          defaultGuestLimit={settings.defaultGuestLimit}
          affiliates={affs.rows.map((a) => ({ id: a.id, label: `${a.name} (${a.referral_code})` }))}
          accessUrl={`${base}/access`}
        />
      </section>

      <form className="card flex flex-wrap items-end gap-3 p-4" role="search">
        <label className="block min-w-[200px] flex-1">
          <span className="label">بحث</span>
          <input name="q" defaultValue={sp.q} className="field" placeholder="رقم الطلب أو اسم العميل أو الهاتف" />
        </label>
        <label className="block">
          <span className="label">الحالة</span>
          <select name="status" defaultValue={sp.status ?? ""} className="field">
            <option value="">الكل</option>
            {Object.entries(ORDER_STATUS_AR).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <button className="btn btn-outline" type="submit">تصفية</button>
      </form>

      <div className="space-y-3">
        {orders.length === 0 ? <p className="card p-8 text-center text-ink-soft">لا توجد طلبات.</p> : null}
        {orders.map((o) => (
          <article key={o.id} className="card p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{o.customerName} <span className="mono text-sm text-ink-soft">{o.reference}</span></p>
                <p className="text-sm text-ink-soft">
                  {o.themeName} (إصدار {o.themeVersion}، لون {o.variant}) — {formatDateTimeAr(o.createdAt)}
                  {o.customerPhone ? <> — <span className="num">{o.customerPhone}</span></> : null}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="badge">{ORDER_STATUS_AR[o.status as OrderStatus] ?? o.status}</span>
                <span className="font-bold text-burgundy">{formatMoney(o.amountMinor, o.currency)}</span>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-soft">
              <span>المدعوون: <span className="num">{o.guestsUsed}/{o.guestLimit}</span></span>
              <span>سيحضرون: <span className="num">{o.rsvpYes}</span></span>
              {o.amountMinor !== o.listPriceMinor ? <span>السعر المعلن: {formatMoney(o.listPriceMinor, o.currency)}</span> : null}
              {o.affiliateName ? <span>المسوق: {o.affiliateName} ({SRC[o.attributionSource ?? ""] ?? ""})</span> : <span>بدون مسوق</span>}
              <span>استلم المبلغ: {o.receivedByType === "affiliate" ? (o.remittedAt ? "المسوق (تم التسليم)" : "المسوق (لم يُسلَّم بعد)") : "المالك"}</span>
              {o.refundedMinor ? <span className="text-danger">مسترجع: {formatMoney(o.refundedMinor, o.currency)}</span> : null}
            </div>
            {notes.rows.filter((n) => n.order_id === o.id).slice(0, 3).map((n, i) => (
              <p key={i} className="mt-2 rounded-lg bg-pearl px-3 py-1.5 text-sm">📝 {n.body} <span className="text-xs text-ink-soft">— {formatDateTimeAr(n.created_at)}</span></p>
            ))}
            <details className="mt-3">
              <summary className="cursor-pointer text-sm font-semibold text-burgundy">إجراءات</summary>
              <div className="mt-3 grid gap-4 md:grid-cols-2">
                <ActionForm action={addNoteAction} className="space-y-2" resetOnSuccess>
                  <input type="hidden" name="orderId" value={o.id} />
                  <span className="label">ملاحظة دعم</span>
                  <textarea name="body" className="field min-h-[70px]" maxLength={4000} required />
                  <select name="support" className="field" defaultValue="">
                    <option value="">حالة الدعم بدون تغيير</option>
                    <option value="open">طلب دعم مفتوح</option>
                    <option value="resolved">تم الحل</option>
                    <option value="none">لا يوجد</option>
                  </select>
                  <SubmitButton className="btn btn-outline btn-sm">إضافة ملاحظة</SubmitButton>
                </ActionForm>
                {o.status !== "refunded" ? (
                  <ActionForm action={refundAction} className="space-y-2" confirm="تأكيد تسجيل الاسترجاع؟ سيتم تعديل العمولة تلقائياً.">
                    <input type="hidden" name="orderId" value={o.id} />
                    <input type="hidden" name="currency" value={o.currency} />
                    <input type="hidden" name="idem" value={randomId(18)} />
                    <span className="label">تسجيل استرجاع / نزاع</span>
                    <div className="flex gap-2">
                      <input name="amount" className="field" dir="ltr" inputMode="decimal" placeholder="المبلغ" required />
                      <select name="kind" className="field"><option value="refund">استرجاع</option><option value="chargeback">نزاع</option></select>
                    </div>
                    <input name="note" className="field" placeholder="السبب" maxLength={300} />
                    <SubmitButton className="btn btn-danger btn-sm">تسجيل</SubmitButton>
                  </ActionForm>
                ) : null}
              </div>
            </details>
          </article>
        ))}
      </div>
    </div>
  );
}

import { requireOwner } from "@/lib/auth";
import { getSettings } from "@/lib/services/settings";
import ActionForm, { SubmitButton } from "@/components/ui/ActionForm";
import { saveSettingsAction } from "../actions";
import { formatDateTimeAr } from "@/lib/invitation/format";

const ACTION_AR: Record<string, string> = {
  "sale.issued": "إصدار رمز لعميل", "owner.login": "دخول المالك", "owner.login_failed": "محاولة دخول فاشلة", "credential.owner_reissued": "رمز بديل لعميل",
  "credential.rotated": "تغيير العميل لرمزه", "affiliate.created": "إنشاء مسوق", "affiliate.updated": "تعديل مسوق", "affiliate.token_reissued": "رمز جديد لمسوق",
  "commission.approved": "اعتماد عمولات", "payout.recorded": "تسجيل دفعة عمولة", "order.refund": "استرجاع", "order.chargeback": "نزاع",
  "settings.updated": "تعديل الإعدادات", "theme.updated": "تعديل تصميم", "workspace.suspended": "إيقاف دعوة", "workspace.active": "تفعيل دعوة",
  "workspace.extended": "تمديد وصول", "workspace.guest_limit": "تغيير عدد المدعوين", "payment.cash_remitted": "استلام نقد من مسوق",
  "customer.login": "دخول عميل", "affiliate.login": "دخول مسوق", "guests.added": "إضافة ضيوف", "guest.deleted": "حذف ضيف",
  "guest.link_reissued": "تجديد رابط ضيف", "guest.link_revoked": "إلغاء رابط ضيف", "invitation.saved": "حفظ دعوة", "owner.mfa_enabled": "تفعيل التحقق بخطوتين",
};

export default async function SettingsAdmin() {
  const { db } = await requireOwner();
  const s = await getSettings(db);
  const logs = await db.query<{ actor_type: string; actor_id: string; action: string; target_type: string; created_at: Date }>(
    `select actor_type, actor_id, action, target_type, created_at from audit_logs where actor_type in ('owner','affiliate','system') or action like 'credential.%' order by id desc limit 80`,
  );
  return (
    <div className="space-y-6">
      <ActionForm action={saveSettingsAction} className="card grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
        <label className="block"><span className="label">نسبة العمولة الافتراضية ٪</span><input name="commissionPct" className="field" dir="ltr" defaultValue={s.defaultCommissionBps / 100} /></label>
        <label className="block"><span className="label">عدد المدعوين الافتراضي للباقة</span><input name="defaultGuestLimit" type="number" className="field" defaultValue={s.defaultGuestLimit} /></label>
        <label className="block"><span className="label">صلاحية رابط الضيف (أيام)</span><input name="guestLinkDays" type="number" className="field" defaultValue={s.guestLinkDays} /></label>
        <label className="block"><span className="label">مدة وصول العميل (أيام)</span><input name="customerAccessDays" type="number" className="field" defaultValue={s.customerAccessDays} /></label>
        <label className="block"><span className="label">أقصى عدد مدعوين لأي دعوة</span><input name="maxGuestsPerInvitation" type="number" className="field" defaultValue={s.maxGuestsPerInvitation} /></label>
        <label className="block"><span className="label">أقصى عدد صور</span><input name="maxPhotos" type="number" className="field" defaultValue={s.maxPhotos} /></label>
        <label className="block"><span className="label">أقصى حجم للصورة (ميغابايت)</span><input name="maxUploadMb" type="number" className="field" defaultValue={s.maxUploadMb} /></label>
        <label className="block"><span className="label">رقم واتساب للطلبات</span><input name="contactWhatsapp" className="field" dir="ltr" defaultValue={s.contactWhatsapp} placeholder="218912345678" /></label>
        <label className="block sm:col-span-2 lg:col-span-3"><span className="label">تعليمات الطلب (تظهر للزوار)</span><textarea name="orderInstructions" className="field" defaultValue={s.orderInstructions} maxLength={400} /></label>
        <label className="flex items-center gap-2"><input type="checkbox" name="allowMusic" defaultChecked={s.allowMusic} className="h-5 w-5 accent-burgundy" /> السماح برفع موسيقى</label>
        <label className="flex items-center gap-2"><input type="checkbox" name="allowPartySize" defaultChecked={s.allowPartySize} className="h-5 w-5 accent-burgundy" /> السماح بسؤال «عدد الحاضرين»</label>
        <label className="flex items-center gap-2"><input type="checkbox" name="suspendOnFullRefund" defaultChecked={s.suspendOnFullRefund} className="h-5 w-5 accent-burgundy" /> إيقاف الدعوة عند الاسترجاع الكامل</label>
        <div className="sm:col-span-2 lg:col-span-3">
          <SubmitButton>حفظ الإعدادات</SubmitButton>
          <p className="hint">تغيير صلاحية روابط الضيوف يسري على الروابط الجديدة فقط. تغيير نسبة العمولة يسري على المسوقين الجدد فقط.</p>
        </div>
      </ActionForm>
      <section className="card overflow-x-auto p-0">
        <h2 className="p-5 pb-0 font-semibold">سجل العمليات الحساسة</h2>
        <table className="table mt-3">
          <thead><tr><th>الوقت</th><th>المنفذ</th><th>العملية</th></tr></thead>
          <tbody>
            {logs.rows.map((l, i) => (
              <tr key={i}>
                <td className="text-xs">{formatDateTimeAr(l.created_at)}</td>
                <td>{{ owner: "المالك", affiliate: "مسوق", customer: "عميل", system: "النظام", guest: "ضيف" }[l.actor_type] ?? l.actor_type}</td>
                <td>{ACTION_AR[l.action] ?? l.action}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

import { requireCustomer } from "@/lib/auth";
import ActionForm, { SubmitButton } from "@/components/ui/ActionForm";
import SecretActionForm from "@/components/ui/SecretActionForm";
import { rotateTokenAction, setPhoneAction } from "../actions";
import { formatDateTimeAr } from "@/lib/invitation/format";

export default async function SettingsPage() {
  const { ws } = await requireCustomer();
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="card p-5">
        <h2 className="font-semibold">رمز الدخول</h2>
        <p className="mt-2 text-sm leading-7 text-ink-soft">إذا شككت أن أحداً اطلع على رمزك، أنشئ رمزاً جديداً. سيتوقف الرمز القديم فوراً وتُغلق كل الجلسات الأخرى، وتبقى أنت مسجلاً هنا.</p>
        <SecretActionForm action={rotateTokenAction} confirm="إنشاء رمز جديد وإلغاء الرمز الحالي؟" secretTitle="رمز الدخول الجديد إلى لوحة دعوتك" filename="رمز-دعوتي.txt">
          <SubmitButton className="btn btn-outline mt-4" pending="جارٍ الإنشاء…">إنشاء رمز دخول جديد</SubmitButton>
        </SecretActionForm>
      </section>
      <section className="card p-5">
        <h2 className="font-semibold">رقم الهاتف للاستعادة</h2>
        <p className="mt-2 text-sm leading-7 text-ink-soft">يساعدنا على التحقق من هويتك إذا فقدت رمز الدخول. لا نرسل رسائل تسويقية.</p>
        <ActionForm action={setPhoneAction} className="mt-4">
          <input name="phone" className="field" dir="ltr" inputMode="tel" defaultValue={ws.recoveryPhone} placeholder="0912345678" maxLength={30} />
          <SubmitButton className="btn btn-primary btn-sm mt-3">حفظ</SubmitButton>
        </ActionForm>
      </section>
      <section className="card p-5 text-sm leading-7">
        <h2 className="font-semibold">معلومات الباقة</h2>
        <p className="mt-2">التصميم: {ws.themeName}</p>
        <p>عدد المدعوين المسموح: <span className="num">{ws.guestLimit}</span></p>
        <p>رقم الطلب: <span className="mono">{ws.orderReference}</span></p>
        <p>صلاحية الوصول حتى: {formatDateTimeAr(ws.accessExpiresAt)}</p>
        <p className="mt-2 text-ink-soft">لزيادة عدد المدعوين أو تمديد الصلاحية تواصل مع الجهة التي اشتريت منها الدعوة.</p>
      </section>
    </div>
  );
}

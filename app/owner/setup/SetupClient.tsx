"use client";
import { useActionState, useState } from "react";
import { SubmitButton, type ActionResult } from "@/components/ui/ActionForm";
import { setupBeginAction, setupCompleteAction } from "../actions";

export default function SetupClient() {
  const [s1, a1] = useActionState(setupBeginAction, null as ActionResult | null);
  const [s2, a2] = useActionState(setupCompleteAction, null as ActionResult | null);
  const [setupToken, setSetupToken] = useState("");
  const step2 = s1?.ok && s1.data;
  return (
    <div className="mt-5">
      {!step2 ? (
        <form action={a1} className="space-y-4">
          <label className="block"><span className="label">رمز الإعداد السري</span><input name="setupToken" type="password" className="field" dir="ltr" required value={setupToken} onChange={(e) => setSetupToken(e.target.value)} /></label>
          <label className="block"><span className="label">اسم المستخدم (حروف لاتينية)</span><input name="username" className="field" dir="ltr" required maxLength={40} autoComplete="username" /></label>
          <label className="block"><span className="label">كلمة المرور (12 حرفاً على الأقل)</span><input name="password" type="password" className="field" dir="ltr" required minLength={12} autoComplete="new-password" /></label>
          <label className="block"><span className="label">تأكيد كلمة المرور</span><input name="password2" type="password" className="field" dir="ltr" required minLength={12} autoComplete="new-password" /></label>
          <SubmitButton pending="جارٍ الإنشاء…">متابعة</SubmitButton>
          {s1?.message && !s1.ok ? <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{s1.message}</p> : null}
        </form>
      ) : (
        <form action={a2} className="space-y-4">
          <p className="text-sm">{s1.message}</p>
          <div className="mx-auto w-56 rounded-xl bg-white p-2" dangerouslySetInnerHTML={{ __html: String(s1.data!.qr) }} role="img" aria-label="رمز QR لتطبيق المصادقة" />
          <p className="text-center text-xs text-ink-soft">أو أدخل المفتاح يدوياً: <span className="mono select-all">{String(s1.data!.secret)}</span></p>
          <input type="hidden" name="ownerId" value={String(s1.data!.ownerId)} />
          <input type="hidden" name="setupToken" value={setupToken} />
          <label className="block"><span className="label">الرمز من تطبيق المصادقة</span><input name="code" className="field mono tracking-[0.3em]" dir="ltr" inputMode="numeric" required maxLength={7} autoComplete="one-time-code" /></label>
          <SubmitButton pending="جارٍ التحقق…">تفعيل الحساب</SubmitButton>
          {s2?.message ? <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{s2.message}</p> : null}
        </form>
      )}
    </div>
  );
}

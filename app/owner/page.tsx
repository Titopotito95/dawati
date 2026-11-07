import Link from "next/link";
import Logo from "@/components/ui/Logo";
import ActionForm, { SubmitButton } from "@/components/ui/ActionForm";
import { getDb } from "@/lib/db";
import { ownerExists } from "@/lib/services/owner";
import { ownerLoginAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "دخول المالك", robots: { index: false } };

export default async function OwnerLogin({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const exists = await ownerExists(await getDb());
  return (
    <main className="paper grid min-h-svh place-items-center px-4 py-10">
      <div className="card w-full max-w-md p-6 sm:p-8">
        <Logo />
        <h1 className="mt-6 font-[family-name:var(--font-display)] text-2xl font-semibold">لوحة المالك</h1>
        {sp.ready ? <p className="mt-3 rounded-xl bg-success/10 px-3 py-2 text-sm text-success">تم تفعيل الحساب والتحقق بخطوتين. يمكنك الدخول الآن.</p> : null}
        {!exists ? (
          <p className="mt-4 text-sm leading-7 text-ink-soft">
            لم يتم إعداد حساب المالك بعد. استخدم الأمر <span className="mono">npm run owner:create</span> على الخادم، أو{" "}
            <Link href="/owner/setup" className="text-burgundy">صفحة الإعداد</Link> مع رمز الإعداد السري.
          </p>
        ) : (
          <ActionForm action={ownerLoginAction} className="mt-5 space-y-4">
            <label className="block">
              <span className="label">اسم المستخدم</span>
              <input name="username" className="field" dir="ltr" autoComplete="username" required maxLength={60} />
            </label>
            <label className="block">
              <span className="label">كلمة المرور</span>
              <input name="password" type="password" className="field" dir="ltr" autoComplete="current-password" required maxLength={200} />
            </label>
            <label className="block">
              <span className="label">رمز التحقق من تطبيق المصادقة</span>
              <input name="code" className="field mono tracking-[0.3em]" dir="ltr" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,7}" required maxLength={7} />
            </label>
            <SubmitButton className="btn btn-primary w-full" pending="جارٍ التحقق…">دخول</SubmitButton>
          </ActionForm>
        )}
      </div>
    </main>
  );
}

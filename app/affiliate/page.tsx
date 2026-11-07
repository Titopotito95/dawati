import Logo from "@/components/ui/Logo";
import ActionForm, { SubmitButton } from "@/components/ui/ActionForm";
import { redeemAffiliateToken } from "./actions";

export const metadata = { title: "دخول المسوقين", robots: { index: false } };

export default async function AffiliateLogin({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  return (
    <main className="paper grid min-h-svh place-items-center px-4 py-10">
      <div className="card w-full max-w-md p-6 sm:p-8">
        <Logo />
        <h1 className="mt-6 font-[family-name:var(--font-display)] text-2xl font-semibold">دخول المسوقين</h1>
        <p className="mt-2 text-sm leading-7 text-ink-soft">أدخل رمز الدخول الخاص بك الذي استلمته من الإدارة.</p>
        {sp.disabled ? <p className="mt-3 rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">تم إيقاف هذا الحساب. يرجى التواصل مع الإدارة.</p> : null}
        {sp.bye ? <p className="mt-3 rounded-xl bg-success/10 px-3 py-2 text-sm text-success">تم تسجيل الخروج.</p> : null}
        <ActionForm action={redeemAffiliateToken} className="mt-5">
          <label htmlFor="t" className="label">رمز المسوق</label>
          <input id="t" name="token" className="field mono" dir="ltr" autoComplete="off" spellCheck={false} placeholder="dwa_xxxx-xxxx-…" required maxLength={80} />
          <SubmitButton className="btn btn-primary mt-4 w-full" pending="جارٍ التحقق…">دخول</SubmitButton>
        </ActionForm>
      </div>
    </main>
  );
}

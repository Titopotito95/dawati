import Link from "next/link";
import SiteHeader from "@/components/ui/SiteHeader";
import ActionForm, { SubmitButton } from "@/components/ui/ActionForm";
import { redeemCustomerToken } from "./actions";

export const metadata = { title: "الدخول برمز الدعوة", robots: { index: false } };

export default async function AccessPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const notice = sp.suspended
    ? "تم إيقاف هذه الدعوة مؤقتاً. يرجى التواصل معنا."
    : sp.expired
      ? "انتهت مدة الوصول إلى هذه الدعوة. يرجى التواصل معنا لتمديدها."
      : sp.bye
        ? "تم تسجيل الخروج بنجاح."
        : null;
  return (
    <div className="paper min-h-svh">
      <SiteHeader />
      <main className="mx-auto max-w-lg px-4 py-12">
        <div className="card p-6 sm:p-8">
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold">لدي رمز دخول</h1>
          <p className="mt-2 leading-7 text-ink-soft">أدخل رمز الدخول الذي استلمته عند الدفع للوصول إلى لوحة دعوتك. لا تحتاج إلى بريد إلكتروني أو كلمة مرور.</p>
          {notice ? <p className="mt-4 rounded-xl bg-rose/10 px-3 py-2 text-sm">{notice}</p> : null}
          <ActionForm action={redeemCustomerToken} className="mt-6">
            <label htmlFor="token" className="label">رمز الدخول</label>
            <input
              id="token"
              name="token"
              className="field mono"
              dir="ltr"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              placeholder="dwc_xxxx-xxxx-…"
              required
              maxLength={80}
            />
            <p className="hint">يبدأ الرمز بـ dwc_ — يمكنك لصقه كما هو مع الشرطات أو المسافات.</p>
            <div className="mt-5">
              <SubmitButton pending="جارٍ التحقق…" className="btn btn-primary w-full">الدخول إلى لوحة دعوتي</SubmitButton>
            </div>
          </ActionForm>
          <div className="mt-6 rounded-xl bg-pearl p-4 text-sm leading-7 text-ink-soft">
            <p className="font-semibold text-ink">فقدت الرمز؟</p>
            <p>تواصل مع الجهة التي اشتريت منها الدعوة. بعد التحقق من اسمك ورقم هاتفك ورقم الطلب سنصدر لك رمزاً جديداً، ويتوقف الرمز القديم فوراً.</p>
          </div>
          <p className="mt-6 text-center text-sm text-ink-soft">
            لم تشترِ بعد؟ <Link href="/themes" className="font-semibold text-burgundy">استكشف التصاميم</Link>
          </p>
        </div>
      </main>
    </div>
  );
}

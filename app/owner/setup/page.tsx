import { redirect } from "next/navigation";
import Logo from "@/components/ui/Logo";
import { getDb } from "@/lib/db";
import { ownerExists } from "@/lib/services/owner";
import SetupClient from "./SetupClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "إعداد حساب المالك", robots: { index: false } };

export default async function SetupPage() {
  if (await ownerExists(await getDb())) redirect("/owner");
  return (
    <main className="paper grid min-h-svh place-items-center px-4 py-10">
      <div className="card w-full max-w-lg p-6 sm:p-8">
        <Logo />
        <h1 className="mt-6 font-[family-name:var(--font-display)] text-2xl font-semibold">إعداد حساب المالك (مرة واحدة)</h1>
        <p className="mt-2 text-sm leading-7 text-ink-soft">
          تتطلب هذه الصفحة رمز الإعداد السري المحدد في متغير البيئة <span className="mono">OWNER_SETUP_TOKEN</span> على الخادم، وتتوقف تلقائياً بعد إنشاء الحساب. التحقق بخطوتين إلزامي.
        </p>
        <SetupClient />
      </div>
    </main>
  );
}

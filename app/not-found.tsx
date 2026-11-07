import Link from "next/link";

export default function NotFound() {
  return (
    <main className="paper grid min-h-svh place-items-center px-4">
      <div className="card max-w-md p-8 text-center">
        <p className="font-[family-name:var(--font-ruqaa)] text-6xl text-burgundy">٤٠٤</p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-2xl font-semibold">الصفحة غير موجودة</h1>
        <p className="mt-3 text-ink-soft">ربما تغيّر الرابط أو كُتب بشكل غير صحيح.</p>
        <Link href="/" className="btn btn-primary mt-6">العودة إلى الرئيسية</Link>
      </div>
    </main>
  );
}

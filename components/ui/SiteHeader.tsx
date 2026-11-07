import Link from "next/link";
import Logo from "./Logo";

export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-rose/15 bg-ivory/85 backdrop-blur supports-[backdrop-filter]:bg-ivory/70">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <Logo />
        <nav className="hidden items-center gap-6 text-[15px] text-ink-soft md:flex" aria-label="التنقل الرئيسي">
          <Link href="/themes" className="hover:text-burgundy">التصاميم</Link>
          <Link href="/#how" className="hover:text-burgundy">كيف تعمل</Link>
          <Link href="/#pricing" className="hover:text-burgundy">الأسعار</Link>
          <Link href="/#faq" className="hover:text-burgundy">الأسئلة الشائعة</Link>
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/access" className="btn btn-ghost btn-sm">لدي رمز دخول</Link>
          <Link href="/themes" className="btn btn-primary btn-sm hidden sm:inline-flex">استكشف التصاميم</Link>
        </div>
      </div>
    </header>
  );
}

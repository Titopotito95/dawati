import Link from "next/link";
import Logo from "./Logo";

/** `overlay`: see-through over the home-page video, turns solid once the hero has scrolled away. */
export default function SiteHeader({ overlay = false }: { overlay?: boolean }) {
  return (
    <header
      className={
        overlay
          ? "site-header-overlay sticky top-0 z-30"
          : "sticky top-0 z-30 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/75"
      }
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
        <Logo />
        <nav className="hidden items-center gap-7 text-[14.5px] text-ink-soft md:flex" aria-label="التنقل الرئيسي">
          <Link href="/themes" className="transition hover:text-burgundy">المجموعة</Link>
          <Link href="/#how" className="transition hover:text-burgundy">كيف تعمل</Link>
          <Link href="/#plans" className="transition hover:text-burgundy">الباقات</Link>
          <Link href="/#faq" className="transition hover:text-burgundy">الأسئلة الشائعة</Link>
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/access" className="btn btn-ghost btn-sm">لدي رمز دخول</Link>
          <Link href="/themes" className="btn btn-primary btn-sm hidden sm:inline-flex">
            استكشف التصاميم <span aria-hidden="true">←</span>
          </Link>
        </div>
      </div>
    </header>
  );
}

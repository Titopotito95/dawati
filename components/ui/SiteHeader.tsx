import Link from "next/link";
import Logo, { LogoSwap } from "./Logo";
import MobileMenu, { type MenuLink } from "./MobileMenu";

const NAV: MenuLink[] = [
  { href: "/themes", label: "المجموعة" },
  { href: "/#how", label: "كيف تعمل" },
  { href: "/#plans", label: "الباقات" },
  { href: "/#faq", label: "الأسئلة الشائعة" },
];

/** `overlay`: see-through over the home-page video, turns solid once the video has scrolled away. */
export default function SiteHeader({ overlay = false }: { overlay?: boolean }) {
  return (
    <header
      className={
        overlay
          ? "site-header-overlay sticky top-0 z-30"
          : "sticky top-0 z-30 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/75"
      }
    >
      {/* phones: balancing space · name in the middle (alternates with a diamond) · menu on the left */}
      <div className="relative grid h-16 grid-cols-[44px_1fr_44px] items-center px-3 md:hidden">
        <span aria-hidden="true" />
        <LogoSwap />
        <MobileMenu
          links={[...NAV, { href: "/access", label: "لدي رمز دخول" }, { href: "/themes", label: "استكشف التصاميم ←" }]}
        />
      </div>

      {/* tablets and desktops */}
      <div className="mx-auto hidden h-16 max-w-6xl items-center justify-between gap-3 px-4 md:flex">
        <Logo />
        <nav className="flex items-center gap-7 text-[14.5px] text-ink-soft" aria-label="التنقل الرئيسي">
          {NAV.map((l) => (
            <Link key={l.href} href={l.href} className="transition hover:text-burgundy">
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/access" className="btn btn-ghost btn-sm">لدي رمز دخول</Link>
          <Link href="/themes" className="btn btn-primary btn-sm inline-flex">
            استكشف التصاميم <span aria-hidden="true">←</span>
          </Link>
        </div>
      </div>
    </header>
  );
}

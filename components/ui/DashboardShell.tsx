import type { ReactNode } from "react";
import Logo from "./Logo";
import NavLinks, { type NavItem } from "./NavLinks";

export default function DashboardShell({
  title,
  roleLabel,
  nav,
  children,
  footer,
  homeHref,
}: {
  title: string;
  roleLabel: string;
  nav: NavItem[];
  children: ReactNode;
  footer?: ReactNode;
  homeHref: string;
}) {
  return (
    <div className="min-h-svh paper">
      <header className="sticky top-0 z-30 border-b border-[var(--hairline)] bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <Logo href={homeHref} />
            <span className="badge badge-burgundy hidden sm:inline-flex">{roleLabel}</span>
          </div>
          <div className="flex items-center gap-2">{footer}</div>
        </div>
        <div className="mx-auto max-w-7xl overflow-x-auto px-2 lg:hidden">
          <NavLinks items={nav} variant="tabs" />
        </div>
      </header>
      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-6">
        <aside className="hidden w-56 shrink-0 lg:block">
          <div className="tile sticky top-24 p-3">
            <NavLinks items={nav} variant="side" />
          </div>
        </aside>
        <main className="min-w-0 flex-1">
          <h1 className="display mb-5 text-2xl sm:text-3xl">{title}</h1>
          {children}
        </main>
      </div>
    </div>
  );
}

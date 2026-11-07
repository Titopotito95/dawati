"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export type MenuLink = { href: string; label: string };

/** Phones: three-line button that opens a drop-down with all header links. */
export default function MobileMenu({ links }: { links: MenuLink[] }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onDown = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  return (
    <div ref={root} className="contents">
      <button
        type="button"
        className="menu-btn"
        aria-label={open ? "إغلاق القائمة" : "القائمة"}
        aria-expanded={open}
        aria-controls="mobile-menu"
        data-open={open || undefined}
        onClick={() => setOpen((o) => !o)}
      >
        <span />
        <span />
        <span />
      </button>
      <nav id="mobile-menu" className="menu-panel" data-open={open || undefined} aria-label="القائمة">
        {links.map((l, i) => (
          <Link
            key={l.href + l.label}
            href={l.href}
            className={i === links.length - 1 ? "btn btn-primary mt-2 w-full justify-center" : "menu-link"}
            onClick={() => setOpen(false)}
          >
            {l.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

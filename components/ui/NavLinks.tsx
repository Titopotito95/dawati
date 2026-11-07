"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = { href: string; label: string; exact?: boolean };

export default function NavLinks({ items, variant }: { items: NavItem[]; variant: "side" | "tabs" }) {
  const path = usePathname();
  const active = (i: NavItem) => (i.exact ? path === i.href : path === i.href || path.startsWith(i.href + "/"));
  if (variant === "tabs") {
    return (
      <nav className="flex gap-1 pb-2 whitespace-nowrap" aria-label="أقسام اللوحة">
        {items.map((i) => (
          <Link
            key={i.href}
            href={i.href}
            className={`rounded-full px-3 py-1.5 text-sm ${active(i) ? "bg-burgundy text-white" : "text-ink-soft hover:bg-rose/10"}`}
            aria-current={active(i) ? "page" : undefined}
          >
            {i.label}
          </Link>
        ))}
      </nav>
    );
  }
  return (
    <nav className="flex flex-col gap-1" aria-label="أقسام اللوحة">
      {items.map((i) => (
        <Link
          key={i.href}
          href={i.href}
          className={`rounded-xl px-3 py-2 text-[15px] ${active(i) ? "bg-burgundy text-white shadow" : "text-ink-soft hover:bg-rose/10"}`}
          aria-current={active(i) ? "page" : undefined}
        >
          {i.label}
        </Link>
      ))}
    </nav>
  );
}

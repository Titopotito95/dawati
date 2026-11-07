import Link from "next/link";
import { BRAND } from "@/lib/brand";

export function SealMark({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <defs>
        <radialGradient id="sealg" cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#fffaf7" />
          <stop offset="0.6" stopColor="#efdcd5" />
          <stop offset="1" stopColor="#c9a49a" />
        </radialGradient>
      </defs>
      <ellipse cx="20" cy="20" rx="15" ry="18" fill="url(#sealg)" stroke="#b08d57" strokeWidth="1" />
      <ellipse cx="20" cy="20" rx="11" ry="14" fill="none" stroke="#fff" strokeWidth="1.2" opacity="0.9" />
      <path d="M14 15c2-2 4-2 6 0 2-2 4-2 6 0M14 25c2 2 4 2 6 0 2 2 4 2 6 0" stroke="#8a6157" strokeWidth="1" fill="none" strokeLinecap="round" />
      <circle cx="20" cy="20" r="2" fill="#b08d57" />
    </svg>
  );
}

export default function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2 no-underline" aria-label={BRAND.name}>
      <SealMark />
      <span className="font-[family-name:var(--font-ruqaa)] text-2xl font-bold text-burgundy leading-none pt-1">{BRAND.name}</span>
    </Link>
  );
}

/** Small faceted diamond (header on phones). */
function Gem() {
  return (
    <svg width="30" height="26" viewBox="0 0 30 26" aria-hidden="true">
      <defs>
        <linearGradient id="gemg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.5" stopColor="#f3e6e2" />
          <stop offset="1" stopColor="#d9bdb5" />
        </linearGradient>
      </defs>
      <path d="M7 1.5h16l5.5 7L15 24.5 1.5 8.5z" fill="url(#gemg)" stroke="#5c1a22" strokeWidth="1.1" strokeLinejoin="round" />
      <path d="M1.5 8.5h27M7 1.5l3 7 5 16 5-16 3-7M10 8.5 15 1.5l5 7" fill="none" stroke="#5c1a22" strokeWidth="0.8" strokeLinejoin="round" opacity="0.7" />
      <path d="M9 3.2 6.6 7" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

/** Phones: the name in the middle of the header, alternating with a little diamond. */
export function LogoSwap({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="logo-swap justify-self-center no-underline" aria-label={BRAND.name}>
      <span className="logo-swap__name font-[family-name:var(--font-ruqaa)] text-2xl font-bold text-burgundy leading-none pt-1">
        {BRAND.name}
      </span>
      <span className="logo-swap__gem">
        <Gem />
      </span>
    </Link>
  );
}

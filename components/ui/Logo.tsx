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

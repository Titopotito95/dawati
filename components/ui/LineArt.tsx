/** Fine line-art drawings (original, stroke = currentColor) used as floating decoration. */
type P = { className?: string; style?: React.CSSProperties };
const base = { fill: "none", stroke: "currentColor", strokeWidth: 1.3, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

export function Rings({ className, style }: P) {
  return (
    <svg viewBox="0 0 96 72" className={className} style={style} aria-hidden="true" {...base}>
      <ellipse cx="36" cy="44" rx="22" ry="20" />
      <ellipse cx="36" cy="44" rx="18" ry="16.5" opacity="0.6" />
      <ellipse cx="60" cy="40" rx="22" ry="20" />
      <ellipse cx="60" cy="40" rx="18" ry="16.5" opacity="0.6" />
      <path d="M54 20l6-9 6 9-6 5z" />
      <path d="M54 20h12M60 11v14" opacity="0.6" />
    </svg>
  );
}

export function SealedEnvelope({ className, style }: P) {
  return (
    <svg viewBox="0 0 96 72" className={className} style={style} aria-hidden="true" {...base}>
      <rect x="10" y="14" width="76" height="48" rx="3" />
      <path d="M10 16l38 26 38-26" />
      <path d="M10 60l28-20M86 60L58 40" opacity="0.6" />
      <ellipse cx="48" cy="42" rx="8" ry="9" />
      <path d="M44.5 40.5c1.4-1.6 2.6-1.6 3.5 0 .9-1.6 2.1-1.6 3.5 0M44.5 44c1.4 1.4 2.6 1.4 3.5 0 .9 1.4 2.1 1.4 3.5 0" opacity="0.7" />
    </svg>
  );
}

export function FlowerSprig({ className, style }: P) {
  return (
    <svg viewBox="0 0 72 96" className={className} style={style} aria-hidden="true" {...base}>
      <path d="M36 92C36 70 34 52 40 30" />
      <path d="M38 62c-8-2-14-8-15-15 7 0 13 5 15 15zM39 50c7-3 12-9 12-16-7 1-11 7-12 16z" />
      <circle cx="41" cy="22" r="6" />
      <path d="M41 16c-2-5 2-9 0-12M35 21c-5-1-8 3-12 1M47 21c5-1 8 3 12 1M38 27c-3 4-1 8-4 11M44 27c3 4 1 8 4 11" />
      <circle cx="41" cy="22" r="2" />
    </svg>
  );
}

export function Swans({ className, style }: P) {
  return (
    <svg viewBox="0 0 110 72" className={className} style={style} aria-hidden="true" {...base}>
      <path d="M52 52c-4-8-7-17-6-27 1-8 8-12 12-7 2 3 0 7-4 7" />
      <path d="M58 18l5 3" />
      <path d="M52 52c-7 4-20 5-30 1-7-3-10-8-9-12 7 5 15 5 22 2" />
      <path d="M58 52c4-8 7-17 6-27-1-8-8-12-12-7" />
      <path d="M58 52c7 4 20 5 30 1 7-3 10-8 9-12-7 5-15 5-22 2" />
      <path d="M16 62c10-3 20 3 30 0s20-3 30 0 18 3 24 0" opacity="0.6" />
    </svg>
  );
}

export function Glasses({ className, style }: P) {
  return (
    <svg viewBox="0 0 80 96" className={className} style={style} aria-hidden="true" {...base}>
      <path d="M22 10h16l-2 22c-1 7-5 10-6 10s-5-3-6-10z" />
      <path d="M30 42v30M22 72h16" />
      <path d="M46 16h16l-2 22c-1 7-5 10-6 10s-5-3-6-10z" />
      <path d="M54 48v30M46 78h16" />
      <path d="M24 20h12M48 26h12" opacity="0.5" />
      <path d="M38 6l3-4M42 8l5-2M40 2l1 2" opacity="0.6" />
    </svg>
  );
}

export function Sparkle({ className, style }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} style={style} aria-hidden="true" {...base}>
      <path d="M12 2v20M2 12h20M5 5l14 14M19 5L5 19" opacity="0.7" />
    </svg>
  );
}

/**
 * Vector ornaments echoing the burgundy/ivory interior references (beaded lace scallops,
 * ribbon bow, swan pair). They are drawn in SVG so they stay crisp at any phone DPR.
 * When the original high-resolution interior art is supplied they can be replaced by layers.
 */
import { useId } from "react";

export function BeadedScallopBand({ flip = false, className = "" }: { flip?: boolean; className?: string }) {
  const id = useId().replace(/:/g, "");
  const n = 9;
  const w = 360;
  const step = w / n;
  let d = `M0 0 L${w} 0 L${w} 18`;
  for (let i = n; i > 0; i--) {
    const x1 = i * step;
    const x0 = (i - 1) * step;
    d += ` Q${x1 - step * 0.02} 46 ${(x0 + x1) / 2} 46 Q${x0 + step * 0.02} 46 ${x0} 18`;
  }
  d += " Z";
  const pearls = Array.from({ length: n * 2 + 1 }, (_, i) => i * (step / 2));
  return (
    <svg
      className={className}
      viewBox="0 0 360 64"
      preserveAspectRatio="none"
      aria-hidden="true"
      style={flip ? { transform: "scaleY(-1)" } : undefined}
    >
      <defs>
        <linearGradient id={`lace-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fbfafa" />
          <stop offset="0.7" stopColor="#efedec" />
          <stop offset="1" stopColor="#dedad9" />
        </linearGradient>
        <radialGradient id={`pearl-${id}`} cx="0.35" cy="0.3" r="0.75">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.45" stopColor="#f2f0f0" />
          <stop offset="1" stopColor="#bdb6b6" />
        </radialGradient>
        <pattern id={`net-${id}`} width="6" height="6" patternUnits="userSpaceOnUse">
          <path d="M0 3 L3 0 L6 3 L3 6 Z" fill="none" stroke="#d6d1d0" strokeWidth="0.5" />
        </pattern>
      </defs>
      <path d={d} fill={`url(#lace-${id})`} />
      <path d={d} fill={`url(#net-${id})`} opacity="0.55" />
      <path d={d} fill="none" stroke="#ffffff" strokeWidth="1.4" opacity="0.9" />
      {pearls.map((x, i) => (
        <circle key={i} cx={x} cy={i % 2 === 0 ? 20 : 47} r={i % 2 === 0 ? 2.1 : 2.6} fill={`url(#pearl-${id})`} />
      ))}
    </svg>
  );
}

export function RibbonBow({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 240 90" aria-hidden="true" fill="none">
      <g stroke="#f7f1ef" strokeLinecap="round" strokeLinejoin="round">
        {/* trailing ribbons */}
        <path d="M120 40 C 95 42, 70 30, 48 34 C 26 38, 14 58, 22 72 C 30 84, 46 74, 40 62" strokeWidth="2.2" />
        <path d="M120 40 C 145 42, 170 30, 192 34 C 214 38, 226 58, 218 72 C 210 84, 194 74, 200 62" strokeWidth="2.2" />
        <path d="M120 42 C 96 46, 74 38, 54 42" strokeWidth="1.2" opacity="0.7" />
        <path d="M120 42 C 144 46, 166 38, 186 42" strokeWidth="1.2" opacity="0.7" />
        {/* loops */}
        <path d="M120 38 C 106 22, 88 18, 86 30 C 84 42, 104 44, 120 38 Z" strokeWidth="2.4" />
        <path d="M120 38 C 134 22, 152 18, 154 30 C 156 42, 136 44, 120 38 Z" strokeWidth="2.4" />
        {/* tails */}
        <path d="M118 40 L 110 62 L 116 58 L 118 66" strokeWidth="2" />
        <path d="M122 40 L 130 62 L 124 58 L 122 66" strokeWidth="2" />
      </g>
      <circle cx="120" cy="38.5" r="4" fill="#fbf8f7" />
    </svg>
  );
}

export function SwanPair({ className = "" }: { className?: string }) {
  // Two facing swans whose necks form a heart; drawn as fine ink line-art.
  return (
    <svg className={className} viewBox="0 0 220 110" aria-hidden="true" fill="none">
      <g stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {/* left swan neck & head */}
        <path d="M104 74 C 96 60, 90 46, 92 30 C 94 16, 106 10, 112 18 C 116 24, 112 30, 106 30" />
        <path d="M112 18 L 120 22" />
        {/* left swan body & wing */}
        <path d="M104 74 C 92 80, 70 82, 52 76 C 40 72, 34 64, 36 58 C 48 66, 62 66, 74 62" />
        <path d="M52 70 C 60 56, 76 50, 90 58" />
        <path d="M58 72 C 66 62, 78 58, 92 64" />
        {/* right swan (mirror) */}
        <path d="M116 74 C 124 60, 130 46, 128 30 C 126 16, 114 10, 108 18" />
        <path d="M108 18 C 104 24, 108 30, 114 30" />
        <path d="M116 74 C 128 80, 150 82, 168 76 C 180 72, 186 64, 184 58 C 172 66, 158 66, 146 62" />
        <path d="M168 70 C 160 56, 144 50, 130 58" />
        <path d="M162 72 C 154 62, 142 58, 128 64" />
        {/* water */}
        <path d="M40 88 C 60 84, 80 92, 100 88 S 140 84, 160 88 S 190 92, 200 88" strokeWidth="1.6" />
        <path d="M62 98 C 80 94, 98 100, 116 96 S 150 94, 166 98" strokeWidth="1.3" />
        <path d="M30 80 L 48 80 M 172 80 L 192 80" strokeWidth="1.3" />
      </g>
    </svg>
  );
}

export function Divider({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 200 16" aria-hidden="true" fill="none">
      <g stroke="currentColor" strokeWidth="1" strokeLinecap="round">
        <path d="M10 8 H 84" />
        <path d="M116 8 H 190" />
        <path d="M100 2 L 106 8 L 100 14 L 94 8 Z" />
        <circle cx="88" cy="8" r="1.6" fill="currentColor" />
        <circle cx="112" cy="8" r="1.6" fill="currentColor" />
      </g>
    </svg>
  );
}

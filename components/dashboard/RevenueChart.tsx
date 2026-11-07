"use client";
import { useState } from "react";

/**
 * Single-series daily revenue (last 30 days). Thin bars with rounded data-ends anchored to the
 * baseline, recessive grid, hover/focus tooltip, and a table view for accessibility.
 */
export default function RevenueChart({ series, format }: { series: { date: string; amountMinor: number; label: string }[]; format: Record<string, string> }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 640;
  const H = 200;
  const padT = 12;
  const padB = 24;
  const max = Math.max(1, ...series.map((s) => s.amountMinor));
  const step = W / series.length;
  const bw = Math.max(3, step - 4);
  const y = (v: number) => padT + (H - padT - padB) * (1 - v / max);
  const ticks = [0, 0.5, 1].map((f) => Math.round(max * f));
  return (
    <div>
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-52 w-full" role="img" aria-label="الإيرادات اليومية لآخر 30 يوماً" onMouseLeave={() => setHover(null)}>
          {ticks.map((t) => (
            <line key={t} x1={0} x2={W} y1={y(t)} y2={y(t)} stroke="#8a6157" strokeOpacity={0.12} strokeWidth={1} />
          ))}
          {series.map((s, i) => {
            const x = W - (i + 1) * step + (step - bw) / 2; // RTL: newest day on the left edge
            const top = y(s.amountMinor);
            const h = Math.max(0, H - padB - top);
            const r = Math.min(4, bw / 2, h);
            const d = h <= 0 ? "" : `M${x},${H - padB} V${top + r} Q${x},${top} ${x + r},${top} H${x + bw - r} Q${x + bw},${top} ${x + bw},${top + r} V${H - padB} Z`;
            return (
              <g key={s.date}>
                {d ? <path d={d} fill={hover === i ? "#431220" : "#5b1a2a"} /> : null}
                <rect
                  x={W - (i + 1) * step}
                  y={0}
                  width={step}
                  height={H}
                  fill="transparent"
                  tabIndex={0}
                  aria-label={`${s.label}: ${format[s.date]}`}
                  onMouseEnter={() => setHover(i)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                />
              </g>
            );
          })}
          <line x1={0} x2={W} y1={H - padB} y2={H - padB} stroke="#8a6157" strokeOpacity={0.35} />
          {[0, 14, 29].map((i) =>
            series[i] ? (
              <text key={i} x={W - (i + 0.5) * step} y={H - 6} textAnchor="middle" fontSize="11" fill="#6d5551">
                {series[i].label}
              </text>
            ) : null,
          )}
        </svg>
        {hover !== null && series[hover] ? (
          <div
            className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-lg bg-ink px-2 py-1 text-xs text-white shadow"
            style={{ left: `${((W - (hover + 0.5) * step) / W) * 100}%` }}
            role="status"
          >
            {series[hover].label} — {format[series[hover].date]}
          </div>
        ) : null}
      </div>
      <details className="mt-2 text-sm">
        <summary className="cursor-pointer text-ink-soft">عرض كجدول</summary>
        <table className="table mt-2">
          <thead><tr><th>اليوم</th><th>الإيراد</th></tr></thead>
          <tbody>
            {series.filter((s) => s.amountMinor > 0).map((s) => (
              <tr key={s.date}><td>{s.label}</td><td>{format[s.date]}</td></tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}

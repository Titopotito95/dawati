import type { ReactNode } from "react";

export default function Stat({ label, value, hint, tone = "default" }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "default" | "green" | "red" | "gold" }) {
  const toneCls = { default: "text-ink", green: "text-success", red: "text-danger", gold: "text-[#7a5a2c]" }[tone];
  return (
    <div className="card p-4">
      <p className="text-[13px] text-ink-soft">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${toneCls}`}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-ink-soft">{hint}</p> : null}
    </div>
  );
}

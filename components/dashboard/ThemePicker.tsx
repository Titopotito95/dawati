"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { changeThemeAction } from "@/app/dashboard/actions";

export type PickerTheme = { slug: string; nameAr: string; thumb: string };

/** Customer design page: choose which invitation design (product) the invitation uses. */
export default function ThemePicker({ themes, current }: { themes: PickerTheme[]; current: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  if (themes.length < 2) return null;
  return (
    <section className="card mb-6 p-5" aria-labelledby="design-pick">
      <h2 id="design-pick" className="text-lg font-semibold">التصميم</h2>
      <p className="mt-1 text-sm text-ink-soft">اختر تصميم الدعوة. تبقى نصوصك وضيوفك وروابطهم وردودهم كما هي.</p>
      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
        {themes.map((t) => {
          const active = t.slug === current;
          return (
            <button
              key={t.slug}
              type="button"
              disabled={pending || active}
              aria-pressed={active}
              onClick={() => {
                setBusy(t.slug);
                setMsg(null);
                start(async () => {
                  const r = await changeThemeAction(t.slug);
                  setMsg({ ok: r.ok, text: r.message || "" });
                  setBusy(null);
                  if (r.ok) router.refresh();
                });
              }}
              className={`overflow-hidden rounded-2xl border text-right transition ${active ? "border-burgundy ring-2 ring-burgundy/30" : "border-[var(--hairline)] hover:border-burgundy/50"}`}
            >
              <img src={t.thumb} alt="" className="aspect-[3/4] w-full object-cover" loading="lazy" />
              <span className="block px-3 py-2 text-sm font-semibold">
                {t.nameAr}
                {active ? <span className="mr-2 text-xs font-normal text-burgundy">(الحالي)</span> : null}
                {busy === t.slug ? <span className="mr-2 text-xs font-normal text-ink-soft">جارٍ التغيير…</span> : null}
              </span>
            </button>
          );
        })}
      </div>
      {msg ? <p className={`mt-3 text-sm ${msg.ok ? "text-success" : "text-danger"}`} aria-live="polite">{msg.text}</p> : null}
    </section>
  );
}

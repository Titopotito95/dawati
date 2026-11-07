"use client";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import PhoneFrame from "@/components/invitation/PhoneFrame";
import InvitationPlayer from "@/components/invitation/InvitationPlayer";
import { sampleViewModel } from "@/lib/invitation/defaults";
import type { ColorVariantKey } from "@/lib/invitation/types";

type V = { key: string; nameAr: string; swatch: string; isDefault: boolean };

export default function ThemePreview({ renderer, variants, header, order }: { renderer: string; variants: V[]; header: ReactNode; order: ReactNode }) {
  const [variant, setVariant] = useState((variants.find((v) => v.isDefault) ?? variants[0])?.key ?? "white");
  const [replay, setReplay] = useState(0);
  const vm = { ...sampleViewModel(variant as ColorVariantKey), renderer };
  return (
    <div className="grid items-start gap-8 md:grid-cols-[1fr_auto]">
      <div className="md:col-start-1 md:row-start-1">{header}</div>
      <div className="flex justify-center md:sticky md:top-24 md:col-start-2 md:row-span-2 md:row-start-1">
        <PhoneFrame label="معاينة التصميم">
          <InvitationPlayer key={`${variant}-${replay}`} vm={vm} badge="معاينة" />
        </PhoneFrame>
      </div>
      <div className="md:col-start-1 md:row-start-2">
        <div className="card p-5">
          <p className="font-semibold">اختر اللون</p>
          <div className="mt-3 flex flex-wrap gap-3" role="radiogroup" aria-label="ألوان التصميم">
            {variants.map((v) => (
              <button
                key={v.key}
                type="button"
                role="radio"
                aria-checked={variant === v.key}
                onClick={() => setVariant(v.key)}
                className={`flex items-center gap-2 rounded-full border px-3 py-2 text-sm transition ${variant === v.key ? "border-burgundy bg-burgundy/5 font-semibold" : "border-rose/30 hover:border-rose"}`}
              >
                <span className="h-6 w-6 rounded-full border border-rose/40" style={{ background: v.swatch }} />
                {v.nameAr}
              </button>
            ))}
          </div>
          <p className="hint mt-3">كل لون مُعدّ كتصميم مستقل بعناية، وليس مجرد فلتر.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setReplay((r) => r + 1)}>إعادة تشغيل العرض</button>
            <Link href={`/demo?theme=${renderer.split("@")[0]}&color=${variant}`} className="btn btn-ghost btn-sm">عرض بملء الشاشة</Link>
          </div>
        </div>
        {order}
      </div>
    </div>
  );
}

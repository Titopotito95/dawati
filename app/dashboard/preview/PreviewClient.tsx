"use client";
import { useState } from "react";
import PhoneFrame from "@/components/invitation/PhoneFrame";
import InvitationPlayer from "@/components/invitation/InvitationPlayer";
import type { InvitationViewModel } from "@/lib/invitation/types";

export default function PreviewClient({ vm }: { vm: InvitationViewModel }) {
  const [k, setK] = useState(0);
  const [name, setName] = useState("اسم الضيف");
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1fr_auto]">
      <div className="card space-y-4 p-5">
        <p className="leading-7 text-ink-soft">هذه معاينة حقيقية للتصميم ببياناتك المحفوظة، كما سيراها ضيوفك. ردود تأكيد الحضور هنا لا تُحفظ.</p>
        <label className="block">
          <span className="label">جرّب اسم ضيف</span>
          <input className="field" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
        </label>
        <button type="button" className="btn btn-outline" onClick={() => setK((x) => x + 1)}>إعادة تشغيل العرض</button>
      </div>
      <div className="flex justify-center">
        <PhoneFrame label="معاينة الدعوة">
          <InvitationPlayer key={k} vm={{ ...vm, guest: vm.guest ? { ...vm.guest, name } : null }} badge="معاينة" />
        </PhoneFrame>
      </div>
    </div>
  );
}

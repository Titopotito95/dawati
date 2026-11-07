"use client";
import { useState, useTransition } from "react";
import CopyButton from "@/components/ui/CopyButton";
import WhatsAppShare from "@/components/ui/WhatsAppShare";
import { reissueLinkAction, revokeLinkAction } from "../actions";
import { formatDateTimeAr } from "@/lib/invitation/format";

type Row = { id: string; name: string; state: string; url: string | null; expiresAt: string | null; openedAt: string | null; openCount: number };
const STATE: Record<string, [string, string]> = {
  active: ["فعّال", "badge badge-green"],
  expired: ["منتهي", "badge badge-red"],
  revoked: ["ملغى", "badge"],
  none: ["بدون رابط", "badge"],
};

export default function LinksTable({ rows, eventLabel }: { rows: Row[]; eventLabel: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const act = (p: Promise<{ ok: boolean; message?: string }>) =>
    start(async () => {
      const r = await p;
      setMsg(r.message || null);
    });
  return (
    <div className="space-y-3">
      {msg ? <p className="rounded-xl bg-success/10 px-3 py-2 text-sm text-success" role="status">{msg}</p> : null}
      <ul className="grid gap-3 md:grid-cols-2">
        {rows.map((r) => {
          const [label, cls] = STATE[r.state] ?? STATE.none;
          return (
            <li key={r.id} className="card p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold">{r.name}</p>
                <span className={cls}>{label}</span>
              </div>
              <p className="mt-1 text-xs text-ink-soft">
                {r.expiresAt ? <>ينتهي: {formatDateTimeAr(r.expiresAt)}</> : null}
                {r.openedAt ? <> — فُتحت {r.openCount} مرة</> : <> — لم تُفتح بعد</>}
              </p>
              {r.state === "active" && r.url ? (
                <>
                  <p className="mono mt-2 truncate rounded-lg bg-pearl px-2 py-1 text-xs text-ink-soft" dir="ltr" title="رابط خاص — لا تنشره">{r.url}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <CopyButton text={r.url} label="نسخ الرابط" />
                    <WhatsAppShare text={`السلام عليكم ${r.name}،\nيسعدنا دعوتكم لحضور ${eventLabel}.\nافتحوا دعوتكم الخاصة من هذا الرابط:`} url={r.url} />
                  </div>
                </>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2 border-t border-rose/10 pt-3">
                <button type="button" className="btn btn-ghost btn-sm" disabled={pending} onClick={() => { if (window.confirm("سيتم إلغاء الرابط الحالي وإنشاء رابط جديد. متابعة؟")) act(reissueLinkAction(r.id)); }}>
                  تجديد الرابط
                </button>
                {r.state === "active" ? (
                  <button type="button" className="btn btn-ghost btn-sm text-danger" disabled={pending} onClick={() => { if (window.confirm("إلغاء هذا الرابط؟ لن يتمكن الضيف من فتحه.")) act(revokeLinkAction(r.id)); }}>
                    إلغاء الرابط
                  </button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

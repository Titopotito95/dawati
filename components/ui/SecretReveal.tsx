"use client";
import CopyButton from "./CopyButton";

/** Displays a one-time secret with copy + download, and clear Arabic guidance. */
export default function SecretReveal({ secret, title, filename, note }: { secret: string; title: string; filename: string; note?: string }) {
  function download() {
    const body = `${title}\n\n${secret}\n\nاحتفظ بهذا الرمز في مكان آمن ولا تشاركه مع أحد.\n`;
    const url = URL.createObjectURL(new Blob([body], { type: "text/plain;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }
  return (
    <div className="mt-4 rounded-2xl border border-gold/40 bg-[#fffaf2] p-4">
      <p className="text-sm font-semibold text-ink">{title}</p>
      <p className="mono mt-2 select-all break-all rounded-xl bg-white px-3 py-3 text-[15px] text-burgundy shadow-inner" dir="ltr">
        {secret}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <CopyButton text={secret} label="نسخ الرمز" />
        <button type="button" className="btn btn-outline btn-sm" onClick={download}>
          حفظ كملف
        </button>
      </div>
      <p className="hint mt-3">
        هذا الرمز سري ويعمل مثل المفتاح. احفظه الآن (صورة شاشة أو ملف أو ملاحظة خاصة)، فلن يظهر مرة أخرى. لا ترسله لأي شخص.
        {note ? <> {note}</> : null}
      </p>
    </div>
  );
}

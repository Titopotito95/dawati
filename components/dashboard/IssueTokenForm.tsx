"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { SubmitButton, type ActionResult } from "@/components/ui/ActionForm";
import SecretReveal from "@/components/ui/SecretReveal";

type ThemeOpt = { slug: string; nameAr: string; priceMajor: string; currency: string; variants: { key: string; nameAr: string }[] };
type AffOpt = { id: string; label: string };

function newKey() {
  const a = new Uint8Array(18);
  crypto.getRandomValues(a);
  return btoa(String.fromCharCode(...a)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Issue a customer token after cash was received in person. A fresh idempotency key is generated
 * for every new issue, so a double tap or network retry can never create two customers.
 */
export default function IssueTokenForm({
  action,
  themes,
  defaultGuestLimit,
  affiliates,
  accessUrl,
}: {
  action: (prev: ActionResult | null, fd: FormData) => Promise<ActionResult>;
  themes: ThemeOpt[];
  defaultGuestLimit: number;
  affiliates?: AffOpt[];
  accessUrl: string;
}) {
  const [state, formAction] = useActionState(action, null);
  const [key, setKey] = useState("");
  const [theme, setTheme] = useState(themes[0]?.slug ?? "");
  const formRef = useRef<HTMLFormElement>(null);
  const t = themes.find((x) => x.slug === theme);

  useEffect(() => setKey(newKey()), []);
  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      setTheme(themes[0]?.slug ?? "");
      setKey(newKey());
    }
  }, [state, themes]);

  const token = state?.ok ? (state.data?.token as string | undefined) : undefined;
  const reference = state?.data?.reference as string | undefined;
  const phone = (state?.data?.phone as string | undefined) || "";
  const waText = token ? `رمز الدخول إلى لوحة دعوتك:\n${token}\n\nادخل من هنا: ${accessUrl}\nاحتفظ بالرمز ولا تشاركه مع أحد.` : "";
  const waUrl = token ? `https://wa.me/${phone.replace(/\D/g, "").replace(/^0/, "218")}?text=${encodeURIComponent(waText)}` : "";

  return (
    <div>
      <form ref={formRef} action={formAction} className="grid gap-4 sm:grid-cols-2">
        <input type="hidden" name="idem" value={key} />
        <label className="block">
          <span className="label">اسم العميل *</span>
          <input name="customerName" className="field" required maxLength={120} />
        </label>
        <label className="block">
          <span className="label">رقم الهاتف (للتحقق عند فقدان الرمز)</span>
          <input name="customerPhone" className="field" dir="ltr" inputMode="tel" maxLength={30} placeholder="0912345678" />
        </label>
        <label className="block">
          <span className="label">التصميم</span>
          <select name="theme" className="field" value={theme} onChange={(e) => setTheme(e.target.value)}>
            {themes.map((x) => (
              <option key={x.slug} value={x.slug}>{x.nameAr}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="label">اللون</span>
          <select name="variant" className="field" key={theme}>
            {t?.variants.map((v) => (
              <option key={v.key} value={v.key}>{v.nameAr}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="label">عدد المدعوين المسموح *</span>
          <input name="guestLimit" type="number" min={1} max={5000} className="field" defaultValue={defaultGuestLimit} required />
        </label>
        <label className="block">
          <span className="label">المبلغ المستلم ({t?.currency === "LYD" ? "د.ل" : t?.currency})</span>
          <input name="amount" className="field" dir="ltr" inputMode="decimal" defaultValue={t?.priceMajor} key={`amt-${theme}`} required />
        </label>
        {affiliates ? (
          <label className="block">
            <span className="label">المسوق الذي باع الدعوة (لاحتساب العمولة)</span>
            <select name="affiliateId" className="field" defaultValue="">
              <option value="">بدون مسوق</option>
              {affiliates.map((a) => (
                <option key={a.id} value={a.id}>{a.label}</option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="block sm:col-span-2">
          <span className="label">ملاحظة (اختياري)</span>
          <input name="note" className="field" maxLength={300} />
        </label>
        <div className="sm:col-span-2">
          <p className="hint mb-3">اضغط «إصدار الرمز» فقط بعد استلام المبلغ نقداً. يُسجَّل البيع ويُنشأ رمز دخول جديد للعميل.</p>
          <SubmitButton pending="جارٍ الإصدار…" disabled={!key}>إصدار الرمز</SubmitButton>
        </div>
      </form>
      <div aria-live="polite">
        {state?.message ? (
          <p className={`mt-4 rounded-xl px-3 py-2 text-sm ${state.ok ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}>{state.message}</p>
        ) : null}
        {token ? (
          <div className="mt-2">
            {reference ? <p className="text-sm">رقم الطلب: <span className="mono">{reference}</span></p> : null}
            <SecretReveal secret={token} title="رمز دخول العميل إلى لوحة دعوته" filename={`رمز-${reference ?? "دعوة"}.txt`} note="سلّمه للعميل مباشرة؛ لن يظهر هنا مرة أخرى." />
            <a href={waUrl} target="_blank" rel="noopener noreferrer" className="btn btn-sm mt-3 bg-[#1f8f4e] text-white hover:bg-[#187540]">
              إرسال الرمز للعميل عبر واتساب
            </a>
          </div>
        ) : null}
      </div>
    </div>
  );
}

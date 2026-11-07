"use client";

import { useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import PhoneFrame from "@/components/invitation/PhoneFrame";
import InvitationPlayer from "@/components/invitation/InvitationPlayer";
import { saveInvitationAction } from "@/app/dashboard/actions";
import {
  EVENT_TYPES,
  EVENT_TYPE_LABELS,
  OPTIONAL_PAGES,
  PAGE_LABELS,
  type ColorVariantKey,
  type InvitationContent,
  type InvitationSettings,
  type InvitationViewModel,
  type PagesConfig,
} from "@/lib/invitation/types";

type Variant = { key: string; nameAr: string; swatch: string };

export interface EditorProps {
  section: "content" | "design";
  renderer: string;
  variants: Variant[];
  initial: { content: InvitationContent; pages: PagesConfig; settings: InvitationSettings; variant: string };
  allowPartySize: boolean;
  children?: ReactNode;
}

const INVITE_DEFAULTS: Record<string, string> = {
  wedding: "نتشرف بدعوتكم لحضور حفل زفاف",
  engagement: "نتشرف بدعوتكم لحضور حفل خطوبة",
  katb: "نتشرف بدعوتكم لحضور عقد قران",
  party: "يسعدنا دعوتكم لحضور",
  other: "يسعدنا دعوتكم لحضور",
};

function comparable(c: InvitationContent, p: PagesConfig, s: InvitationSettings, v: string) {
  const { photos: _a, musicUrl: _b, ...rest } = c;
  void _a;
  void _b;
  return JSON.stringify({ rest, p, s, v });
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint ? <span className="hint block">{hint}</span> : null}
    </label>
  );
}

export default function InvitationEditor({ section, renderer, variants, initial, allowPartySize, children }: EditorProps) {
  const [content, setContent] = useState(initial.content);
  const [pages, setPages] = useState(initial.pages);
  const [settings, setSettings] = useState(initial.settings);
  const [variant, setVariant] = useState(initial.variant);
  const [saved, setSaved] = useState(() => comparable(initial.content, initial.pages, initial.settings, initial.variant));
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [replay, setReplay] = useState(0);
  const [showPreview, setShowPreview] = useState(false);

  // keep server-managed fields (photos, music) fresh when the server re-renders after uploads
  useEffect(() => {
    setContent((c) => ({ ...c, photos: initial.content.photos, musicUrl: initial.content.musicUrl }));
  }, [initial.content.photos, initial.content.musicUrl]);

  const dirty = comparable(content, pages, settings, variant) !== saved;

  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const set = <K extends keyof InvitationContent>(k: K, v: InvitationContent[K]) => setContent((c) => ({ ...c, [k]: v }));

  const vm: InvitationViewModel = useMemo(
    () => ({
      renderer,
      variant: variant as ColorVariantKey,
      content,
      pages,
      settings,
      mode: "preview",
      guest: { name: "اسم الضيف", maxPartySize: settings.defaultMaxPartySize, rsvp: null, expiresAt: "" },
    }),
    [renderer, variant, content, pages, settings],
  );

  function save() {
    setMsg(null);
    start(async () => {
      const { photos: _p, musicUrl: _m, ...editable } = content;
      void _p;
      void _m;
      const r = await saveInvitationAction({ content: editable, pages, settings, variant });
      setMsg({ ok: r.ok, text: r.message || (r.ok ? "تم الحفظ" : "تعذر الحفظ") });
      if (r.ok) setSaved(comparable(content, pages, settings, variant));
    });
  }

  const couple = !(content.eventType === "party" || content.eventType === "other");

  const preview = (
    <div className="flex flex-col items-center gap-3">
      <PhoneFrame label="المعاينة الحية">
        <InvitationPlayer key={replay} vm={vm} badge="معاينة" />
      </PhoneFrame>
      <div className="flex gap-2">
        <button type="button" className="btn btn-outline btn-sm" onClick={() => setReplay((r) => r + 1)}>إعادة تشغيل العرض</button>
      </div>
      <p className="hint max-w-[300px] text-center">المس الختم لفتح الدعوة. التعديلات تظهر مباشرة في المعاينة.</p>
    </div>
  );

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[1fr_auto]">
      <div className="space-y-5">
        {section === "content" ? (
          <>
            <section className="card space-y-4 p-5">
              <h2 className="font-semibold">المناسبة والأسماء</h2>
              <Field label="نوع المناسبة">
                <select
                  className="field"
                  value={content.eventType}
                  onChange={(e) => {
                    const t = e.target.value as InvitationContent["eventType"];
                    setContent((c) => ({ ...c, eventType: t, inviteLine: Object.values(INVITE_DEFAULTS).includes(c.inviteLine) ? INVITE_DEFAULTS[t] : c.inviteLine }));
                  }}
                >
                  {EVENT_TYPES.map((t) => (
                    <option key={t} value={t}>{EVENT_TYPE_LABELS[t]}</option>
                  ))}
                </select>
              </Field>
              {couple ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="اسم العريس"><input className="field" maxLength={60} value={content.groomName} onChange={(e) => set("groomName", e.target.value)} /></Field>
                  <Field label="اسم العروس"><input className="field" maxLength={60} value={content.brideName} onChange={(e) => set("brideName", e.target.value)} /></Field>
                </div>
              ) : (
                <Field label="عنوان المناسبة" hint="مثال: حفل تخرج سارة"><input className="field" maxLength={80} value={content.eventTitle} onChange={(e) => set("eventTitle", e.target.value)} /></Field>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="الحروف الأولى على الختم" hint="حرفان أو ثلاثة، مثل: م س"><input className="field" maxLength={8} value={content.initials} onChange={(e) => set("initials", e.target.value)} /></Field>
                <Field label="عبارة الترحيب بالضيف" hint="تظهر قبل اسم الضيف"><input className="field" maxLength={40} value={content.guestGreeting} onChange={(e) => set("guestGreeting", e.target.value)} /></Field>
              </div>
            </section>

            <section className="card space-y-4 p-5">
              <h2 className="font-semibold">نص الدعوة</h2>
              <label className="flex items-center gap-2 text-[15px]">
                <input type="checkbox" className="h-5 w-5 accent-burgundy" checked={content.showBismillah} onChange={(e) => set("showBismillah", e.target.checked)} />
                إظهار «بسم الله الرحمن الرحيم»
              </label>
              <Field label="سطر العائلة (اختياري)" hint="مثال: يتشرف آل فلان وآل فلان"><input className="field" maxLength={140} value={content.hostLine} onChange={(e) => set("hostLine", e.target.value)} /></Field>
              <Field label="العبارة الافتتاحية"><input className="field" maxLength={120} value={content.openingLine} onChange={(e) => set("openingLine", e.target.value)} /></Field>
              <Field label="نص الدعوة"><input className="field" maxLength={160} value={content.inviteLine} onChange={(e) => set("inviteLine", e.target.value)} /></Field>
              <Field label="رسالة الترحيب"><textarea className="field" maxLength={600} value={content.welcomeMessage} onChange={(e) => set("welcomeMessage", e.target.value)} /></Field>
              <Field label="رسالة خاصة (صفحة اختيارية)"><textarea className="field" maxLength={1200} value={content.customMessage} onChange={(e) => set("customMessage", e.target.value)} /></Field>
              <Field label="كلمة الختام"><textarea className="field" maxLength={400} value={content.closingMessage} onChange={(e) => set("closingMessage", e.target.value)} /></Field>
            </section>

            <section className="card space-y-4 p-5">
              <h2 className="font-semibold">الموعد والمكان</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="التاريخ"><input type="date" className="field" value={content.eventDate} onChange={(e) => set("eventDate", e.target.value)} /></Field>
                <Field label="الوقت"><input type="time" className="field" value={content.eventTime} onChange={(e) => set("eventTime", e.target.value)} /></Field>
              </div>
              <Field label="ملاحظة الوقت (اختياري)" hint="مثال: بعد صلاة العشاء"><input className="field" maxLength={80} value={content.timeNote} onChange={(e) => set("timeNote", e.target.value)} /></Field>
              <Field label="اسم القاعة أو المكان"><input className="field" maxLength={120} value={content.venueName} onChange={(e) => set("venueName", e.target.value)} /></Field>
              <Field label="العنوان"><input className="field" maxLength={240} value={content.address} onChange={(e) => set("address", e.target.value)} /></Field>
              <Field label="رابط الموقع على الخريطة (اختياري)" hint="انسخ رابط المشاركة من خرائط Google ويبدأ بـ https://">
                <input className="field" dir="ltr" inputMode="url" maxLength={500} value={content.mapsUrl} onChange={(e) => set("mapsUrl", e.target.value)} placeholder="https://maps.app.goo.gl/..." />
              </Field>
            </section>
          </>
        ) : (
          <>
            <section className="card p-5">
              <h2 className="font-semibold">لون التصميم</h2>
              <div className="mt-3 flex flex-wrap gap-3" role="radiogroup" aria-label="ألوان التصميم">
                {variants.map((v) => (
                  <button
                    key={v.key}
                    type="button"
                    role="radio"
                    aria-checked={variant === v.key}
                    onClick={() => setVariant(v.key)}
                    className={`flex items-center gap-2 rounded-full border px-3 py-2 text-sm ${variant === v.key ? "border-burgundy bg-burgundy/5 font-semibold" : "border-rose/30"}`}
                  >
                    <span className="h-6 w-6 rounded-full border border-rose/40" style={{ background: v.swatch }} />
                    {v.nameAr}
                  </button>
                ))}
              </div>
            </section>
            <section className="card p-5">
              <h2 className="font-semibold">صفحات الدعوة</h2>
              <p className="hint">اختر الأقسام التي تظهر لضيوفك بعد فتح الظرف.</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {OPTIONAL_PAGES.map((k) => (
                  <label key={k} className="flex items-center gap-2 rounded-xl border border-rose/20 px-3 py-2">
                    <input type="checkbox" className="h-5 w-5 accent-burgundy" checked={pages[k]} onChange={(e) => setPages((p) => ({ ...p, [k]: e.target.checked }))} />
                    {PAGE_LABELS[k]}
                  </label>
                ))}
              </div>
            </section>
            <section className="card space-y-3 p-5">
              <h2 className="font-semibold">تأكيد الحضور</h2>
              <label className="flex items-center gap-2">
                <input type="checkbox" className="h-5 w-5 accent-burgundy" checked={settings.rsvpEnabled} onChange={(e) => setSettings((s) => ({ ...s, rsvpEnabled: e.target.checked }))} />
                السماح للضيوف بتأكيد الحضور
              </label>
              {allowPartySize ? (
                <>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" className="h-5 w-5 accent-burgundy" checked={settings.allowPartySize} onChange={(e) => setSettings((s) => ({ ...s, allowPartySize: e.target.checked }))} />
                    سؤال الضيف عن «عدد الحاضرين»
                  </label>
                  {settings.allowPartySize ? (
                    <Field label="العدد الافتراضي المسموح لكل دعوة" hint="يمكن تغييره لكل ضيف من صفحة المدعوين">
                      <input type="number" min={1} max={50} className="field w-32" value={settings.defaultMaxPartySize} onChange={(e) => setSettings((s) => ({ ...s, defaultMaxPartySize: Math.min(50, Math.max(1, Number(e.target.value) || 1)) }))} />
                    </Field>
                  ) : null}
                </>
              ) : null}
            </section>
            {children}
          </>
        )}

        <div className="sticky bottom-3 z-20 flex flex-wrap items-center gap-3 rounded-2xl border border-rose/20 bg-white/95 p-3 shadow-lg backdrop-blur">
          <button type="button" className="btn btn-primary" onClick={save} disabled={pending || !dirty}>
            {pending ? "جارٍ الحفظ…" : "حفظ التغييرات"}
          </button>
          <button type="button" className="btn btn-outline xl:hidden" onClick={() => setShowPreview((v) => !v)}>
            {showPreview ? "إخفاء المعاينة" : "معاينة الدعوة"}
          </button>
          <span className="text-sm text-ink-soft" aria-live="polite">
            {msg ? <span className={msg.ok ? "text-success" : "text-danger"}>{msg.text}</span> : dirty ? "لديك تغييرات غير محفوظة" : "كل التغييرات محفوظة"}
          </span>
        </div>
        {showPreview ? <div className="xl:hidden">{preview}</div> : null}
      </div>
      <aside className="hidden xl:sticky xl:top-24 xl:block">{preview}</aside>
    </div>
  );
}

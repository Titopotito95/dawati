import Link from "next/link";
import SiteHeader from "@/components/ui/SiteHeader";
import SiteFooter from "@/components/ui/SiteFooter";
import WhatsAppFloat from "@/components/ui/WhatsAppFloat";
import HeroBackground from "@/components/ui/HeroBackground";
import CinematicIntro from "@/components/ui/CinematicIntro";
import PhoneFrame from "@/components/invitation/PhoneFrame";
import InvitationPlayer from "@/components/invitation/InvitationPlayer";
import { Sparkle } from "@/components/ui/LineArt";
import { sampleViewModel } from "@/lib/invitation/defaults";
import { getDb } from "@/lib/db";
import { listThemes } from "@/lib/services/catalog";
import { getSettings } from "@/lib/services/settings";
import { orderContact } from "@/lib/contact";
import { formatMoney } from "@/lib/money";
import { themeThumb } from "@/lib/themes";

export const dynamic = "force-dynamic";

const STEPS = [
  { t: "اختر التصميم واللون", d: "تصفّح المجموعة وشاهد الدعوة تُفتح كما سيراها ضيوفك تماماً." },
  { t: "ادفع نقداً واستلم رمزك", d: "تواصل معنا أو مع ممثلنا وادفع يداً بيد، فتستلم فوراً رمز الدخول الخاص بدعوتك." },
  { t: "خصّص دعوتك", d: "اكتب الأسماء والموعد والمكان، وأضف صوركم وأسماء ضيوفكم." },
  { t: "أرسل الدعوات", d: "لكل ضيف رابط باسمه ترسله عبر واتساب بلمسة." },
];

const FAQ = [
  { q: "هل يحتاج الضيف إلى تطبيق أو حساب؟", a: "لا. يفتح الضيف الرابط مباشرة من واتساب، ويرى دعوته باسمه." },
  { q: "كيف أدفع؟", a: "الدفع نقداً يداً بيد مع ممثلنا المعتمد أو معنا مباشرة. لا نطلب أي بيانات بطاقة على الموقع." },
  { q: "ماذا لو فقدت رمز الدخول؟", a: "تواصل معنا وبعد التحقق من اسمك وهاتفك ورقم الطلب نصدر لك رمزاً جديداً، ويتوقف القديم فوراً." },
  { q: "كم مدة صلاحية رابط الضيف؟", a: "رابط كل ضيف صالح 7 أيام من إنشائه، ويمكنك تجديده في أي وقت." },
  { q: "هل يمكنني تعديل الدعوة بعد إرسالها؟", a: "نعم، أي تعديل تحفظه يظهر فوراً لكل الضيوف الذين يملكون روابط فعّالة." },
  { q: "هل تصلح لغير الأعراس؟", a: "نعم: الخطوبة، عقد القران، الحفلات وكل المناسبات الخاصة." },
];

export default async function Home() {
  const db = await getDb();
  const [themes, settings] = await Promise.all([listThemes(db), getSettings(db)]);
  const contact = await orderContact(db);
  const first = themes[0];
  const price = first ? formatMoney(first.priceMinor, first.currency) : "";
  const vm = { ...sampleViewModel("blush"), renderer: "pearl-lotus@1" }; // front-page phone shows the Pearl Lotus invitation

  return (
    <div className="home-page min-h-svh">
      <CinematicIntro />
      <HeroBackground />
      <SiteHeader overlay />
      <main>
        {/* ---------------- hero: phone preview over the video ---------------- */}
        <section className="hero-panel -mt-16 pb-14">
          <h1 className="sr-only">دعوتك… بداية حكاية جميلة</h1>

          <div className="phone-stage relative mx-auto flex max-w-5xl justify-center px-4">
            <PhoneFrame label="عرض حي للدعوة">
              <InvitationPlayer vm={vm} showcase />
            </PhoneFrame>
            <div className="phone-reflection" aria-hidden="true" />
          </div>
        </section>

        {/* ---------------- the collection ---------------- */}
        <section className="mx-auto max-w-6xl px-4 pt-20" aria-labelledby="collection">
          <div className="flex items-end justify-between gap-4">
            <div>
              <span className="eyebrow">المجموعة</span>
              <h2 id="collection" className="display mt-2 text-3xl sm:text-4xl">تصاميم تُروى كقصة</h2>
            </div>
            <Link href="/themes" className="link-arrow text-sm">
              كل التصاميم <span aria-hidden="true">←</span>
            </Link>
          </div>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {themes.map((t) => {
              const def = t.variants.find((v) => v.isDefault) ?? t.variants[0];
              return (
                <article key={t.id} className="group">
                  <Link href={`/themes/${t.slug}`} className="tile block overflow-hidden p-5">
                    <div className="aspect-[3/4] overflow-hidden rounded-xl bg-white shadow-[var(--shadow-elegant)]">
                      <img
                        src={themeThumb(t.renderer, def?.key ?? "white")}
                        alt={`تصميم ${t.nameAr}`}
                        className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.04]"
                        loading="lazy"
                      />
                    </div>
                  </Link>
                  <div className="mt-4 flex items-start justify-between gap-3 px-1">
                    <div>
                      <h3 className="font-[family-name:var(--font-display)] text-xl font-bold text-ink">{t.nameAr}</h3>
                      <div className="mt-2 flex items-center gap-1.5" aria-label="الألوان المتاحة">
                        {t.variants.map((v) => (
                          <span key={v.key} title={v.nameAr} className="h-4 w-4 rounded-full border border-[var(--hairline)]" style={{ background: v.swatch }} />
                        ))}
                      </div>
                    </div>
                    <p className="text-lg font-semibold text-burgundy">{formatMoney(t.priceMinor, t.currency)}</p>
                  </div>
                  <div className="mt-4 flex gap-2 px-1">
                    <Link href={`/themes/${t.slug}`} className="btn btn-outline btn-sm">معاينة التصميم</Link>
                    <Link href={`/themes/${t.slug}#order`} className="btn btn-primary btn-sm">اختيار التصميم</Link>
                  </div>
                </article>
              );
            })}
            <div className="tile flex flex-col items-center justify-center p-8 text-center text-ink-soft">
              <Sparkle className="w-6 text-gold" />
              <p className="mt-3 font-[family-name:var(--font-display)] text-xl text-ink">تصاميم جديدة قريباً</p>
              <p className="mt-2 text-sm leading-7">ألوان ملكية، أسود وذهبي، عنابي، شمبانيا، وردي ترابي وغيرها.</p>
            </div>
          </div>
        </section>

        {/* ---------------- how it works ---------------- */}
        <section id="how" className="mx-auto max-w-6xl scroll-mt-20 px-4 pt-24">
          <div className="text-center">
            <span className="eyebrow">كيف تعمل</span>
            <h2 className="display mt-2 text-3xl sm:text-4xl">أربع خطوات بسيطة</h2>
          </div>
          <ol className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <li key={s.t} className="card p-6">
                <span className="font-[family-name:var(--font-display)] text-4xl text-gold">{i + 1}</span>
                <p className="mt-3 font-semibold text-ink">{s.t}</p>
                <p className="mt-2 text-sm leading-7 text-ink-soft">{s.d}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* ---------------- plans ---------------- */}
        <section id="plans" className="mx-auto max-w-5xl scroll-mt-20 px-4 pt-24">
          <div className="text-center">
            <span className="eyebrow">الباقات</span>
            <h2 className="display mt-2 text-3xl sm:text-4xl">دفعة واحدة، بدون اشتراكات</h2>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-2">
            <div className="rounded-[22px] bg-plan-1 p-7 text-plan-1-text">
              <p className="text-sm font-semibold">الباقة الكاملة</p>
              <p className="mt-3 font-[family-name:var(--font-display)] text-5xl font-bold">{price}</p>
              <p className="mt-1 text-sm opacity-80">حتى {settings.defaultGuestLimit} مدعواً</p>
              <ul className="mt-6 space-y-2.5 text-[15px]">
                {["دعوة متحركة فاخرة بتصميم من اختيارك", "رابط خاص باسم كل ضيف", "صور العروسين وموقع الحفل على الخريطة", "تعديل الدعوة في أي وقت"].map((x) => (
                  <li key={x} className="flex items-start gap-2">
                    <span aria-hidden="true">✓</span>
                    <span>{x}</span>
                  </li>
                ))}
              </ul>
              {contact.whatsappUrl ? (
                <a href={contact.whatsappUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary mt-7 w-full">
                  {contact.viaAffiliate ? `اطلب عبر ممثلنا ${contact.name}` : "اطلب دعوتك"}
                </a>
              ) : (
                <Link href="/themes" className="btn btn-primary mt-7 w-full">اختر تصميمك</Link>
              )}
            </div>
            <div className="rounded-[22px] bg-plan-2 p-7 text-plan-2-text">
              <p className="text-sm font-semibold">مناسبات كبيرة</p>
              <p className="mt-3 font-[family-name:var(--font-display)] text-4xl font-bold">عدد أكبر من المدعوين؟</p>
              <p className="mt-3 text-[15px] leading-8 opacity-90">
                نحدد عدد المدعوين في باقتك حسب مناسبتك عند الطلب. تواصل معنا لنخبرك بالسعر المناسب لعدد ضيوفك.
              </p>
              <p className="mt-4 text-sm leading-7 opacity-80">{settings.orderInstructions}</p>
              {contact.whatsappUrl ? (
                <a href={contact.whatsappUrl} target="_blank" rel="noopener noreferrer" className="btn btn-outline mt-7 w-full border-current text-current">
                  تواصل معنا
                </a>
              ) : null}
            </div>
          </div>
        </section>

        {/* ---------------- FAQ ---------------- */}
        <section id="faq" className="mx-auto max-w-3xl scroll-mt-20 px-4 pt-24">
          <div className="text-center">
            <span className="eyebrow">الأسئلة الشائعة</span>
            <h2 className="display mt-2 text-3xl sm:text-4xl">كل ما تودّ معرفته</h2>
          </div>
          <div className="mt-8 divide-y divide-[var(--hairline)] border-y border-[var(--hairline)]">
            {FAQ.map((f) => (
              <details key={f.q} className="group py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-ink marker:hidden">
                  {f.q}
                  <span className="text-xl text-burgundy transition group-open:rotate-45" aria-hidden="true">+</span>
                </summary>
                <p className="mt-3 leading-8 text-ink-soft">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* ---------------- closing band ---------------- */}
        <section className="mx-[var(--hero-inset)] mt-24 overflow-hidden rounded-[var(--hero-radius)] bg-burgundy px-6 py-14 text-center text-ivory">
          <p className="font-[family-name:var(--font-display)] text-3xl font-bold sm:text-4xl">استلمت رمز دعوتك؟</p>
          <p className="mx-auto mt-3 max-w-md text-[15px] leading-8 opacity-85">ادخل إلى لوحة دعوتك لتكتب تفاصيل مناسبتك وتضيف ضيوفك وترسل الروابط.</p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link href="/access" className="btn btn-light">لدي رمز دخول</Link>
            <Link href="/demo" className="btn border border-ivory/50 text-ivory hover:bg-white/10">جرّب الدعوة بنفسك</Link>
          </div>
        </section>
      </main>
      <SiteFooter blend />
      <WhatsAppFloat href={contact.whatsappUrl} label={contact.viaAffiliate ? `تواصل مع ${contact.name} عبر واتساب` : "تواصل معنا عبر واتساب"} />
    </div>
  );
}

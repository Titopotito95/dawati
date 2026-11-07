import Link from "next/link";
import SiteHeader from "@/components/ui/SiteHeader";
import SiteFooter from "@/components/ui/SiteFooter";
import PhoneFrame from "@/components/invitation/PhoneFrame";
import InvitationPlayer from "@/components/invitation/InvitationPlayer";
import { sampleViewModel } from "@/lib/invitation/defaults";
import { getDb } from "@/lib/db";
import { listThemes } from "@/lib/services/catalog";
import { getSettings } from "@/lib/services/settings";
import { orderContact } from "@/lib/contact";
import { formatMoney } from "@/lib/money";
import { themeThumb } from "@/lib/themes";

export const dynamic = "force-dynamic";

const STEPS = [
  { t: "اختر التصميم واللون", d: "تصفّح التصاميم وشاهد الدعوة وهي تُفتح كما سيراها ضيوفك تماماً." },
  { t: "ادفع نقداً واستلم رمزك", d: "تواصل معنا أو مع ممثلنا وادفع يداً بيد، فتستلم فوراً رمز دخول خاصاً بدعوتك وعدد المدعوين في باقتك." },
  { t: "خصّص دعوتك", d: "أدخل الرمز، واكتب أسماء العروسين والموعد والمكان، وأضف صوركم وأسماء ضيوفكم." },
  { t: "أرسل وتابع الردود", d: "لكل ضيف رابط خاص باسمه ترسله عبر واتساب، وتتابع من سيحضر ومن اعتذر لحظة بلحظة." },
];

const FAQ = [
  { q: "هل يحتاج الضيف إلى تطبيق أو حساب؟", a: "لا. يفتح الضيف الرابط مباشرة من واتساب على هاتفه، ويرى دعوته باسمه، ويؤكد حضوره بلمسة." },
  { q: "كيف أدفع؟", a: "الدفع نقداً يداً بيد مع ممثلنا المعتمد أو معنا مباشرة. لا نطلب أي بيانات بطاقة على الموقع." },
  { q: "ماذا لو فقدت رمز الدخول؟", a: "تواصل معنا وسنتحقق من بياناتك (الاسم والهاتف ورقم الطلب) ثم نصدر لك رمزاً جديداً، ويتوقف الرمز القديم فوراً." },
  { q: "كم مدة صلاحية رابط الضيف؟", a: "رابط كل ضيف صالح لمدة 7 أيام من إنشائه، ويمكنك تجديده في أي وقت من لوحة دعوتك دون أن يضيع ردّه." },
  { q: "هل يمكنني تعديل الدعوة بعد إرسالها؟", a: "نعم، أي تعديل تحفظه يظهر فوراً لكل الضيوف الذين يملكون روابط فعّالة." },
  { q: "هل تصلح لغير الأعراس؟", a: "نعم: الخطوبة، عقد القران، الحفلات وكل المناسبات الخاصة." },
];

export default async function Home() {
  const db = await getDb();
  const [themes, settings] = await Promise.all([listThemes(db), getSettings(db)]);
  const contact = await orderContact(db);
  const featured = themes.filter((t) => t.featured).slice(0, 3);
  const price = themes[0] ? formatMoney(themes[0].priceMinor, themes[0].currency) : "";
  const vm = sampleViewModel("white");

  return (
    <div className="paper min-h-svh">
      <SiteHeader />
      <main>
        {/* ---------- hero ---------- */}
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-10 pt-8 md:grid-cols-2 md:pt-14">
          <div className="text-center md:text-start">
            <p className="badge badge-gold mb-4">دعوات رقمية فاخرة بلمسة دانتيل ولؤلؤ</p>
            <h1 className="font-[family-name:var(--font-ruqaa)] text-5xl leading-[1.35] text-burgundy sm:text-6xl">دعوتك... بداية حكاية جميلة</h1>
            <p className="mt-4 font-[family-name:var(--font-display)] text-2xl text-ink">صمّم دعوة زفاف تليق بفرحتك</p>
            <p className="mx-auto mt-4 max-w-md leading-8 text-ink-soft md:mx-0">
              ظرف لؤلؤي يُفتح بلمسة على الختم، فتتفتّح أجنحته وتخرج بطاقة باسم ضيفك. رابط خاص لكل ضيف، وتأكيد حضور تتابعه من هاتفك.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3 md:justify-start">
              <Link href="/themes" className="btn btn-primary">استكشف التصاميم</Link>
              <Link href="/demo" className="btn btn-outline">جرّب الدعوة بنفسك</Link>
            </div>
            <p className="mt-5 text-sm text-ink-soft">
              لديك رمز دعوة؟{" "}
              <Link href="/access" className="font-semibold text-burgundy underline-offset-4 hover:underline">لدي رمز دخول</Link>
            </p>
          </div>
          <div className="flex justify-center">
            <PhoneFrame label="عرض حي للدعوة">
              <InvitationPlayer vm={vm} showcase />
            </PhoneFrame>
          </div>
        </section>

        {/* ---------- benefits ---------- */}
        <section className="mx-auto grid max-w-6xl gap-4 px-4 py-8 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["تُفتح كأنها حقيقية", "حركة سينمائية لظرف وأجنحة وختم — ليست صوراً متتالية."],
            ["باسم كل ضيف", "رابط خاص لكل مدعو يظهر فيه اسمه، دون حساب أو كلمة مرور."],
            ["تأكيد الحضور", "سأحضر بإذن الله أو أعتذر — وتظهر الردود في لوحتك فوراً."],
            ["عربية بالكامل", "خطوط عربية أنيقة واتجاه صحيح من اليمين لليسار على كل الهواتف."],
          ].map(([t, d]) => (
            <div key={t} className="card p-5">
              <p className="font-[family-name:var(--font-display)] text-lg font-semibold text-burgundy">{t}</p>
              <p className="mt-2 text-sm leading-7 text-ink-soft">{d}</p>
            </div>
          ))}
        </section>

        {/* ---------- featured themes ---------- */}
        <section className="mx-auto max-w-6xl px-4 py-10" aria-labelledby="featured">
          <div className="mb-6 flex items-end justify-between gap-4">
            <h2 id="featured" className="font-[family-name:var(--font-display)] text-3xl font-semibold">تصاميم مختارة</h2>
            <Link href="/themes" className="text-sm font-semibold text-burgundy">كل التصاميم ←</Link>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((t) => {
              const def = t.variants.find((v) => v.isDefault) ?? t.variants[0];
              return (
                <article key={t.id} className="card overflow-hidden">
                  <Link href={`/themes/${t.slug}`} className="block aspect-[3/4] overflow-hidden bg-blush">
                    <img src={themeThumb(t.renderer, def?.key ?? "white")} alt={`تصميم ${t.nameAr}`} className="h-full w-full object-cover transition duration-700 hover:scale-105" loading="lazy" />
                  </Link>
                  <div className="p-5">
                    <h3 className="font-[family-name:var(--font-display)] text-xl font-semibold">{t.nameAr}</h3>
                    <div className="mt-2 flex items-center gap-2" aria-label="الألوان المتاحة">
                      {t.variants.map((v) => (
                        <span key={v.key} title={v.nameAr} className="h-5 w-5 rounded-full border border-rose/40" style={{ background: v.swatch }} />
                      ))}
                    </div>
                    <p className="mt-3 text-lg font-bold text-burgundy">{formatMoney(t.priceMinor, t.currency)}</p>
                    <div className="mt-4 flex gap-2">
                      <Link href={`/themes/${t.slug}`} className="btn btn-outline btn-sm">معاينة التصميم</Link>
                      <Link href={`/themes/${t.slug}#order`} className="btn btn-primary btn-sm">اختيار التصميم</Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {/* ---------- how it works ---------- */}
        <section id="how" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-12">
          <h2 className="mb-8 text-center font-[family-name:var(--font-display)] text-3xl font-semibold">كيف تعمل؟</h2>
          <ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <li key={s.t} className="card relative p-5 pt-8">
                <span className="absolute -top-4 right-5 grid h-9 w-9 place-items-center rounded-full bg-burgundy font-bold text-white shadow">{i + 1}</span>
                <p className="font-semibold">{s.t}</p>
                <p className="mt-2 text-sm leading-7 text-ink-soft">{s.d}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* ---------- pricing ---------- */}
        <section id="pricing" className="mx-auto max-w-3xl scroll-mt-24 px-4 py-12">
          <div className="card overflow-hidden text-center">
            <div className="bg-burgundy px-6 py-8 text-white">
              <p className="font-[family-name:var(--font-display)] text-xl">باقة الدعوة الكاملة</p>
              <p className="mt-3 text-5xl font-bold">{price}</p>
              <p className="mt-2 text-sm opacity-85">دفعة واحدة نقداً — بدون اشتراكات</p>
            </div>
            <ul className="grid gap-3 px-6 py-7 text-start text-[15px] sm:grid-cols-2">
              {[
                "دعوة متحركة فاخرة بتصميم من اختيارك",
                `حتى ${settings.defaultGuestLimit} مدعواً (يمكن زيادة العدد عند الطلب)`,
                "رابط خاص باسم كل ضيف",
                "تأكيد الحضور ومتابعة الردود",
                "صور العروسين وموقع الحفل على الخريطة",
                "تعديل الدعوة في أي وقت",
              ].map((x) => (
                <li key={x} className="flex items-start gap-2">
                  <span className="mt-1 text-gold">◆</span>
                  <span>{x}</span>
                </li>
              ))}
            </ul>
            <div className="px-6 pb-8">
              <p className="mx-auto mb-4 max-w-md text-sm leading-7 text-ink-soft">{settings.orderInstructions}</p>
              {contact.whatsappUrl ? (
                <a href={contact.whatsappUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
                  {contact.viaAffiliate ? `اطلب عبر ممثلنا ${contact.name}` : "اطلب دعوتك عبر واتساب"}
                </a>
              ) : (
                <Link href="/themes" className="btn btn-primary">اختر تصميمك</Link>
              )}
            </div>
          </div>
        </section>

        {/* ---------- FAQ ---------- */}
        <section id="faq" className="mx-auto max-w-3xl scroll-mt-24 px-4 py-12">
          <h2 className="mb-6 text-center font-[family-name:var(--font-display)] text-3xl font-semibold">الأسئلة الشائعة</h2>
          <div className="space-y-3">
            {FAQ.map((f) => (
              <details key={f.q} className="card group p-5">
                <summary className="cursor-pointer list-none font-semibold marker:hidden">
                  <span className="inline-block w-5 text-gold transition group-open:rotate-45">+</span> {f.q}
                </summary>
                <p className="mt-3 leading-8 text-ink-soft">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-4 py-8 text-center">
          <div className="card p-8">
            <p className="font-[family-name:var(--font-display)] text-2xl font-semibold">استلمت رمز دعوتك؟</p>
            <p className="mt-2 text-ink-soft">ادخل إلى لوحة دعوتك لتخصيصها وإضافة ضيوفك.</p>
            <Link href="/access" className="btn btn-primary mt-5">لدي رمز دخول</Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

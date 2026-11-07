import Link from "next/link";
import SiteHeader from "@/components/ui/SiteHeader";
import SiteFooter from "@/components/ui/SiteFooter";
import { getDb } from "@/lib/db";
import { listThemes } from "@/lib/services/catalog";
import { formatMoney } from "@/lib/money";
import { themeThumb } from "@/lib/themes";

export const dynamic = "force-dynamic";
export const metadata = { title: "التصاميم" };

export default async function ThemesPage() {
  const db = await getDb();
  const themes = await listThemes(db);
  return (
    <div className="paper min-h-svh">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-10">
        <span className="eyebrow">المجموعة</span>
        <h1 className="display mt-2 text-4xl">تصاميم تُروى كقصة</h1>
        <p className="mt-3 text-ink-soft">كل تصميم يأتي بألوان منسّقة بعناية. اضغط «معاينة التصميم» لترى الدعوة تُفتح كما سيراها ضيوفك.</p>
        {themes.length === 0 ? (
          <p className="card mt-8 p-8 text-center text-ink-soft">لا توجد تصاميم متاحة حالياً.</p>
        ) : (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {themes.map((t) => {
              const def = t.variants.find((v) => v.isDefault) ?? t.variants[0];
              return (
                <article key={t.id} className="group">
                  <Link href={`/themes/${t.slug}`} className="tile block overflow-hidden p-5">
                    <div className="aspect-[3/4] overflow-hidden rounded-xl bg-white shadow-[var(--shadow-elegant)]">
                      <img src={themeThumb(t.renderer, def?.key ?? "white")} alt={`تصميم ${t.nameAr}`} className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.04]" loading="lazy" />
                    </div>
                  </Link>
                  <div className="px-1 pt-4">
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="font-[family-name:var(--font-display)] text-xl font-bold">{t.nameAr}</h2>
                      {t.featured ? <span className="badge badge-gold">مميز</span> : null}
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm leading-7 text-ink-soft">{t.descriptionAr}</p>
                    <div className="mt-3 flex items-center gap-2" aria-label="الألوان المتاحة">
                      {t.variants.map((v) => (
                        <span key={v.key} title={v.nameAr} className="h-4 w-4 rounded-full border border-[var(--hairline)]" style={{ background: v.swatch }} />
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
        )}
        <p className="mt-10 text-center text-sm text-ink-soft">تصاميم جديدة بألوان ملكية، أسود وذهبي، عنابي، شمبانيا، وردي ترابي وغيرها قريباً.</p>
      </main>
      <SiteFooter />
    </div>
  );
}

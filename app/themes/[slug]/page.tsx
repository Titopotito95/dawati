import { notFound } from "next/navigation";
import Link from "next/link";
import SiteHeader from "@/components/ui/SiteHeader";
import SiteFooter from "@/components/ui/SiteFooter";
import { getDb } from "@/lib/db";
import { getThemeBySlug } from "@/lib/services/catalog";
import { getSettings } from "@/lib/services/settings";
import { orderContact } from "@/lib/contact";
import { formatMoney } from "@/lib/money";
import ThemePreview from "./ThemePreview";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const db = await getDb();
  const t = await getThemeBySlug(db, slug);
  return { title: t ? `تصميم ${t.nameAr}` : "التصميم غير موجود" };
}

export default async function ThemePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const db = await getDb();
  const t = await getThemeBySlug(db, slug);
  if (!t) notFound();
  const [settings, contact] = await Promise.all([getSettings(db), orderContact(db, t.nameAr)]);
  return (
    <div className="paper min-h-svh">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <nav className="mb-4 text-sm text-ink-soft" aria-label="مسار التنقل">
          <Link href="/themes" className="hover:text-burgundy">التصاميم</Link> / <span>{t.nameAr}</span>
        </nav>
        <ThemePreview
          renderer={t.renderer}
          variants={t.variants.map((v) => ({ key: v.key, nameAr: v.nameAr, swatch: v.swatch, isDefault: v.isDefault }))}
          header={
            <>
              <h1 className="font-[family-name:var(--font-display)] text-4xl font-semibold">{t.nameAr}</h1>
              <p className="mt-3 leading-8 text-ink-soft">{t.descriptionAr}</p>
              <p className="mt-4 text-3xl font-bold text-burgundy">{formatMoney(t.priceMinor, t.currency)}</p>
              <p className="mt-1 text-sm text-ink-soft">يشمل حتى {settings.defaultGuestLimit} مدعواً — ويمكن زيادة العدد عند الطلب</p>
            </>
          }
          order={
            <div id="order" className="card mt-6 scroll-mt-24 p-5">
              <p className="font-semibold">كيف أطلب هذا التصميم؟</p>
              <p className="mt-2 text-sm leading-7 text-ink-soft">{settings.orderInstructions}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {contact.whatsappUrl ? (
                  <a href={contact.whatsappUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
                    {contact.viaAffiliate ? `اطلب عبر ممثلنا ${contact.name}` : "شراء الدعوة عبر واتساب"}
                  </a>
                ) : null}
                <Link href="/access" className="btn btn-outline">لدي رمز دخول</Link>
              </div>
            </div>
          }
        />
      </main>
      <SiteFooter />
    </div>
  );
}

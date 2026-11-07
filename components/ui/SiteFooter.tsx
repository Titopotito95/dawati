import Link from "next/link";
import { BRAND } from "@/lib/brand";

export default function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-rose/15 bg-pearl/60">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 text-sm text-ink-soft sm:grid-cols-3">
        <div>
          <p className="font-[family-name:var(--font-ruqaa)] text-xl text-burgundy">{BRAND.name}</p>
          <p className="mt-2 leading-7">دعوات رقمية فاخرة تُفتح كأنها حقيقية — لحفلات الزفاف والخطوبة وعقد القران وكل مناسباتكم السعيدة.</p>
        </div>
        <div className="flex flex-col gap-2">
          <Link href="/themes">التصاميم</Link>
          <Link href="/access">الدخول برمز الدعوة</Link>
          <Link href="/order">متابعة طلبي</Link>
          <Link href="/affiliate">دخول المسوقين</Link>
        </div>
        <div className="leading-7">
          <p>الدفع نقداً عبر ممثلنا المعتمد في ليبيا.</p>
          {BRAND.whatsapp ? (
            <a href={`https://wa.me/${BRAND.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="text-burgundy">
              تواصل معنا عبر واتساب
            </a>
          ) : null}
          <p className="mt-2 text-xs">© {new Date().getFullYear()} {BRAND.name}</p>
        </div>
      </div>
    </footer>
  );
}

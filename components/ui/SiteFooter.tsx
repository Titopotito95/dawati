import Link from "next/link";
import { BRAND } from "@/lib/brand";

export default function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-[var(--hairline)] bg-white">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 text-sm text-ink-soft sm:grid-cols-3">
        <div>
          <p className="font-[family-name:var(--font-ruqaa)] text-2xl text-burgundy">{BRAND.name}</p>
          <p className="mt-2 leading-7">دعوات رقمية فاخرة تُفتح كأنها حقيقية — لحفلات الزفاف والخطوبة وعقد القران وكل مناسباتكم السعيدة.</p>
        </div>
        <div className="flex flex-col gap-2">
          <p className="mb-1 text-xs font-semibold text-ink">روابط</p>
          <Link href="/themes" className="hover:text-burgundy">المجموعة</Link>
          <Link href="/demo" className="hover:text-burgundy">جرّب الدعوة</Link>
          <Link href="/access" className="hover:text-burgundy">الدخول برمز الدعوة</Link>
          <Link href="/affiliate" className="hover:text-burgundy">دخول المسوقين</Link>
        </div>
        <div className="leading-7">
          <p className="mb-1 text-xs font-semibold text-ink">الطلب</p>
          <p>الدفع نقداً يداً بيد عبر ممثلنا المعتمد في ليبيا.</p>
          <p className="mt-3 text-xs">© {new Date().getFullYear()} {BRAND.name}</p>
        </div>
      </div>
    </footer>
  );
}

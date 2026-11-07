import { headers } from "next/headers";
import { requireAffiliate } from "@/lib/auth";
import { listThemes } from "@/lib/services/catalog";
import { getSettings } from "@/lib/services/settings";
import { publicBaseUrl } from "@/lib/security/request";
import IssueTokenForm from "@/components/dashboard/IssueTokenForm";
import { affiliateIssueAction } from "../../actions";

function major(minor: number, currency: string) {
  const e = currency === "LYD" ? 3 : 2;
  return (minor / 10 ** e).toString();
}

export default async function AffiliateOrdersPage() {
  const { db, affiliate } = await requireAffiliate();
  if (!affiliate.canIssueTokens) {
    return (
      <div className="card p-6 leading-8 text-ink-soft">
        <p className="font-semibold text-ink">إصدار رموز العملاء غير مفعّل لحسابك</p>
        <p>عند استلامك مبلغاً من عميل، أرسل للإدارة اسمه ورقم هاتفه والتصميم وعدد المدعوين، وستصدر الإدارة الرمز وتسجّل البيع باسمك لتُحتسب عمولتك.</p>
      </div>
    );
  }
  const [themes, settings] = await Promise.all([listThemes(db), getSettings(db)]);
  return (
    <div className="card p-5">
      <h2 className="mb-1 font-semibold">إصدار رمز لعميل جديد</h2>
      <p className="mb-5 text-sm text-ink-soft">بعد استلام المبلغ يداً بيد، سجّل البيع هنا لتحصل على رمز الدخول الخاص بالعميل. المبلغ يُسجَّل كعهدة نقدية لديك حتى تسلّمه للإدارة.</p>
      <IssueTokenForm
        action={affiliateIssueAction}
        themes={themes.map((t) => ({ slug: t.slug, nameAr: t.nameAr, priceMajor: major(t.priceMinor, t.currency), currency: t.currency, variants: t.variants.map((v) => ({ key: v.key, nameAr: v.nameAr })) }))}
        defaultGuestLimit={settings.defaultGuestLimit}
        accessUrl={`${publicBaseUrl(await headers())}/access`}
      />
    </div>
  );
}

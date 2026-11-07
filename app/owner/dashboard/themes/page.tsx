import Link from "next/link";
import { requireOwner } from "@/lib/auth";
import { listThemes } from "@/lib/services/catalog";
import { exponent } from "@/lib/money";
import { themeThumb } from "@/lib/themes";
import ActionForm, { SubmitButton } from "@/components/ui/ActionForm";
import { updateThemeAction } from "../actions";

export default async function ThemesAdmin() {
  const { db } = await requireOwner();
  const themes = await listThemes(db, { includeInactive: true });
  return (
    <div className="space-y-5">
      <p className="text-sm leading-7 text-ink-soft">
        كل دعوة مرتبطة بإصدار ثابت من التصميم، لذلك تغيير السعر أو إيقاف تصميم لا يؤثر على الدعوات القائمة. إضافة تصميم جديد تتم برمجياً (مكوّن عرض + أصول + إصدار جديد) دون تعديل منطق البيع أو الرموز أو تأكيد الحضور.
      </p>
      {themes.map((t) => (
        <ActionForm key={t.id} action={updateThemeAction} className="card grid gap-5 p-5 md:grid-cols-[160px_1fr]">
          <img src={themeThumb(t.renderer, t.variants.find((v) => v.isDefault)?.key ?? "white")} alt="" className="aspect-[3/4] w-40 rounded-xl object-cover" />
          <div className="space-y-3">
            <input type="hidden" name="id" value={t.id} />
            <input type="hidden" name="currency" value={t.currency} />
            <div className="flex flex-wrap items-center gap-2">
              <span className="mono text-sm text-ink-soft">{t.slug} · v{t.version} · {t.renderer}</span>
              <Link href={`/themes/${t.slug}`} className="text-sm text-burgundy">معاينة</Link>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="block"><span className="label">الاسم</span><input name="name" defaultValue={t.nameAr} className="field" maxLength={80} /></label>
              <label className="block"><span className="label">السعر ({t.currency})</span><input name="price" defaultValue={String(t.priceMinor / 10 ** exponent(t.currency))} className="field" dir="ltr" inputMode="decimal" /></label>
              <label className="block"><span className="label">الحالة</span>
                <select name="status" defaultValue={t.status} className="field"><option value="active">نشط</option><option value="draft">مسودة</option><option value="disabled">موقوف</option></select>
              </label>
            </div>
            <label className="block"><span className="label">الوصف</span><textarea name="description" defaultValue={t.descriptionAr} className="field min-h-[70px]" maxLength={600} /></label>
            <label className="flex items-center gap-2"><input type="checkbox" name="featured" defaultChecked={t.featured} className="h-5 w-5 accent-burgundy" /> تصميم مميز في الصفحة الرئيسية</label>
            <fieldset>
              <legend className="label">الألوان المتاحة</legend>
              <div className="flex flex-wrap gap-3">
                {t.variants.map((v) => (
                  <label key={v.id} className="flex items-center gap-2 rounded-full border border-rose/30 px-3 py-1.5 text-sm">
                    <input type="hidden" name="variantIds" value={v.id} />
                    <input type="checkbox" name="enabled" value={v.id} defaultChecked={v.status === "active"} className="accent-burgundy" />
                    <span className="h-4 w-4 rounded-full border" style={{ background: v.swatch }} />
                    {v.nameAr}
                  </label>
                ))}
              </div>
            </fieldset>
            <SubmitButton className="btn btn-primary btn-sm">حفظ</SubmitButton>
          </div>
        </ActionForm>
      ))}
    </div>
  );
}

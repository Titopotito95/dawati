/** 002 — theme #1 "Pearl Lace" (350 LYD) with its curated, separately prepared colour variants. */
export const sql = /* sql */ `
with t as (
  insert into themes (slug, name_ar, description_ar, category, status, featured, sort_order, price_minor, currency)
  values ('pearl-lace', 'لؤلؤة الدانتيل',
          'ظرف دانتيل لؤلؤي مطرز يُفتح بلمسة على الختم، فتتفتح أجنحته وتخرج بطاقة الدعوة بأسماء العروسين واسم ضيفكم.',
          'classic', 'active', true, 1, 350000, 'LYD')
  returning id
), v as (
  insert into theme_versions (theme_id, version, renderer, config, status)
  select id, 1, 'pearl-lace@1',
         '{"assets":"/assets/themes/pearl-lace/v1","openingSeconds":6,"pages":["welcome","details","venue","photos","message","rsvp","thanks"]}'::jsonb,
         'published'
  from t
  returning id
)
insert into theme_color_variants (theme_version_id, key, name_ar, swatch, is_default, sort_order)
select v.id, x.key, x.name_ar, x.swatch, x.is_default, x.sort_order
from v cross join (values
  ('white', 'أبيض لؤلؤي', '#f3edee', true, 1),
  ('ivory', 'عاجي وردي', '#f2ded7', false, 2),
  ('champagne', 'شمبانيا', '#f1dabb', false, 3)
) as x(key, name_ar, swatch, is_default, sort_order);
`;

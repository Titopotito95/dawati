/** 004 — theme #2 "Pearl Lotus" (350 LYD): pearl cover with a spinning gold medallion and sliding doors. */
export const sql = /* sql */ `
with t as (
  insert into themes (slug, name_ar, description_ar, category, status, featured, sort_order, price_minor, currency)
  values ('pearl-lotus', 'لوتس اللؤلؤ',
          'غلاف من عرق اللؤلؤ بزهور اللوتس الوردية؛ بلمسة يدور الوسام الذهبي ثم ينفتح الغلاف كبابين منزلقين لتظهر صفحات الدعوة باسم ضيفكم.',
          'classic', 'active', true, 2, 350000, 'LYD')
  on conflict (slug) do nothing
  returning id
), v as (
  insert into theme_versions (theme_id, version, renderer, config, status)
  select id, 1, 'pearl-lotus@1',
         '{"assets":"/assets/themes/pearl-lotus/v1","openingSeconds":3,"pages":["welcome","details","venue","message","rsvp","thanks"]}'::jsonb,
         'published'
  from t
  returning id
)
insert into theme_color_variants (theme_version_id, key, name_ar, swatch, is_default, sort_order)
select v.id, 'blush', 'وردي لؤلؤي', '#f4e4e1', true, 1
from v;
`;

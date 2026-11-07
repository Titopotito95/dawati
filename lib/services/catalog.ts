import "server-only";
import type { Queryable } from "@/lib/db";
import { num } from "@/lib/db";

export interface CatalogVariant {
  id: string;
  key: string;
  nameAr: string;
  swatch: string;
  isDefault: boolean;
  status: string;
}
export interface CatalogTheme {
  id: string;
  slug: string;
  nameAr: string;
  descriptionAr: string;
  category: string;
  status: string;
  featured: boolean;
  priceMinor: number;
  currency: string;
  versionId: string;
  version: number;
  renderer: string;
  variants: CatalogVariant[];
}

/** Themes with their CURRENT published version. Existing invitations keep the version they were bought with. */
export async function listThemes(q: Queryable, opts: { includeInactive?: boolean } = {}): Promise<CatalogTheme[]> {
  const r = await q.query<Record<string, unknown>>(
    `select t.*, v.id as version_id, v.version, v.renderer
       from themes t
       join lateral (
         select * from theme_versions tv where tv.theme_id = t.id and tv.status = 'published'
         order by tv.version desc limit 1
       ) v on true
      where ($1::boolean or t.status = 'active')
      order by t.featured desc, t.sort_order, t.created_at`,
    [!!opts.includeInactive],
  );
  if (r.rows.length === 0) return [];
  const vids = r.rows.map((x) => x.version_id as string);
  const vr = await q.query<Record<string, unknown>>(
    `select * from theme_color_variants where theme_version_id = any($1::uuid[]) order by sort_order`,
    [vids],
  );
  return r.rows.map((t) => ({
    id: t.id as string,
    slug: t.slug as string,
    nameAr: t.name_ar as string,
    descriptionAr: t.description_ar as string,
    category: t.category as string,
    status: t.status as string,
    featured: !!t.featured,
    priceMinor: num(t.price_minor),
    currency: t.currency as string,
    versionId: t.version_id as string,
    version: num(t.version),
    renderer: t.renderer as string,
    variants: vr.rows
      .filter((v) => v.theme_version_id === t.version_id && (opts.includeInactive || v.status === "active"))
      .map((v) => ({
        id: v.id as string,
        key: v.key as string,
        nameAr: v.name_ar as string,
        swatch: v.swatch as string,
        isDefault: !!v.is_default,
        status: v.status as string,
      })),
  }));
}

export async function getThemeBySlug(q: Queryable, slug: string, opts: { includeInactive?: boolean } = {}): Promise<CatalogTheme | null> {
  const all = await listThemes(q, opts);
  return all.find((t) => t.slug === slug) ?? null;
}

export async function variantsForVersion(q: Queryable, versionId: string): Promise<CatalogVariant[]> {
  const r = await q.query<Record<string, unknown>>(
    `select * from theme_color_variants where theme_version_id = $1 order by sort_order`,
    [versionId],
  );
  return r.rows.map((v) => ({
    id: v.id as string,
    key: v.key as string,
    nameAr: v.name_ar as string,
    swatch: v.swatch as string,
    isDefault: !!v.is_default,
    status: v.status as string,
  }));
}

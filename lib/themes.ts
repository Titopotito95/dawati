/** Client-safe helpers for theme assets (thumbnails etc.), keyed by renderer. */
/** Browsers cache theme images for a year: bump a renderer's revision whenever its images change. */
const REV: Record<string, string> = { "pearl-lotus@1": "6" };

export function themeThumb(renderer: string, variant: string): string {
  const [name, ver] = renderer.split("@");
  const rev = REV[renderer];
  return `/assets/themes/${name}/v${ver}/${variant}/thumb.webp${rev ? `?v=${rev}` : ""}`;
}

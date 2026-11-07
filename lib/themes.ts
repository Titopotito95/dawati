/** Client-safe helpers for theme assets (thumbnails etc.), keyed by renderer. */
export function themeThumb(renderer: string, variant: string): string {
  const [name, ver] = renderer.split("@");
  return `/assets/themes/${name}/v${ver}/${variant}/thumb.webp`;
}

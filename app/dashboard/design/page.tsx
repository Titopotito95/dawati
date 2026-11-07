import { requireCustomer } from "@/lib/auth";
import { variantsForVersion, listThemes } from "@/lib/services/catalog";
import { themeThumb } from "@/lib/themes";
import ThemePicker from "@/components/dashboard/ThemePicker";
import { getSettings } from "@/lib/services/settings";
import InvitationEditor from "@/components/dashboard/InvitationEditor";
import { PhotoManager, MusicManager } from "@/components/dashboard/MediaManagers";

export default async function DesignPage() {
  const { db, ws } = await requireCustomer();
  const [variants, settings, themes] = await Promise.all([variantsForVersion(db, ws.themeVersionId), getSettings(db), listThemes(db)]);
  // designs the customer may switch to: active, priced at or below the design they bought
  const curPrice = themes.find((t) => t.slug === ws.themeSlug)?.priceMinor ?? Infinity;
  const pick = themes
    .filter((t) => t.priceMinor <= curPrice || t.slug === ws.themeSlug)
    .map((t) => ({ slug: t.slug, nameAr: t.nameAr, thumb: themeThumb(t.renderer, t.variants.find((v) => v.isDefault)?.key ?? t.variants[0]?.key ?? "white") }));
  return (
    <>
    <ThemePicker themes={pick} current={ws.themeSlug} />
    <InvitationEditor
      key={ws.themeVersionId}
      section="design"
      renderer={ws.renderer}
      variants={variants.filter((v) => v.status === "active").map((v) => ({ key: v.key, nameAr: v.nameAr, swatch: v.swatch }))}
      initial={{ content: ws.content, pages: ws.pages, settings: ws.settings, variant: ws.variant }}
      allowPartySize={settings.allowPartySize}
    >
      <PhotoManager photos={ws.content.photos || []} maxPhotos={settings.maxPhotos} maxMb={settings.maxUploadMb} />
      {settings.allowMusic ? <MusicManager musicUrl={ws.content.musicUrl || ""} /> : null}
    </InvitationEditor>
    </>
  );
}

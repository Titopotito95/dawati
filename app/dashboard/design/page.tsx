import { requireCustomer } from "@/lib/auth";
import { variantsForVersion } from "@/lib/services/catalog";
import { getSettings } from "@/lib/services/settings";
import InvitationEditor from "@/components/dashboard/InvitationEditor";
import { PhotoManager, MusicManager } from "@/components/dashboard/MediaManagers";

export default async function DesignPage() {
  const { db, ws } = await requireCustomer();
  const [variants, settings] = await Promise.all([variantsForVersion(db, ws.themeVersionId), getSettings(db)]);
  return (
    <InvitationEditor
      section="design"
      renderer={ws.renderer}
      variants={variants.filter((v) => v.status === "active").map((v) => ({ key: v.key, nameAr: v.nameAr, swatch: v.swatch }))}
      initial={{ content: ws.content, pages: ws.pages, settings: ws.settings, variant: ws.variant }}
      allowPartySize={settings.allowPartySize}
    >
      <PhotoManager photos={ws.content.photos || []} maxPhotos={settings.maxPhotos} maxMb={settings.maxUploadMb} />
      {settings.allowMusic ? <MusicManager musicUrl={ws.content.musicUrl || ""} /> : null}
    </InvitationEditor>
  );
}

import { headers } from "next/headers";
import { requireCustomer } from "@/lib/auth";
import { listGuests } from "@/lib/services/guests";
import { getSettings } from "@/lib/services/settings";
import { publicBaseUrl } from "@/lib/security/request";
import GuestManager from "@/components/dashboard/GuestManager";

export default async function GuestsPage() {
  const { db, ws } = await requireCustomer();
  const [guests, settings] = await Promise.all([listGuests(db, ws.invitationId, publicBaseUrl(await headers())), getSettings(db)]);
  return (
    <GuestManager
      guests={guests.map((g) => ({ id: g.id, name: g.name, maxPartySize: g.maxPartySize, rsvp: g.rsvp, partySize: g.partySize, linkState: g.linkState }))}
      guestLimit={ws.guestLimit}
      allowPartySize={settings.allowPartySize && ws.settings.allowPartySize}
      defaultParty={ws.settings.defaultMaxPartySize}
    />
  );
}

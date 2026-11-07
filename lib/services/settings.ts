import "server-only";
import type { Queryable } from "@/lib/db";

/**
 * Business policy, editable by the owner. Defaults are documented here and in the README.
 * Commission basis: the amount actually collected for the order (price − discount). Cash sales
 * in Libya carry no gateway fees or VAT today; if that changes, set the flags below and the
 * basis is reduced accordingly for NEW sales only (each commission stores its own basis/rate).
 */
export interface Settings {
  defaultCommissionBps: number;
  referralWindowDays: number;
  defaultGuestLimit: number;
  guestLinkDays: number;
  customerAccessDays: number;
  commissionExcludeFeesBps: number; // e.g. 250 = deduct a 2.5% fee from the basis (0 for cash)
  suspendOnFullRefund: boolean;
  maxGuestsPerInvitation: number;
  maxPhotos: number;
  maxUploadMb: number;
  allowMusic: boolean;
  allowPartySize: boolean;
  contactWhatsapp: string;
  orderInstructions: string;
}

export const DEFAULT_SETTINGS: Settings = {
  defaultCommissionBps: 1500,
  referralWindowDays: 30,
  defaultGuestLimit: 150,
  guestLinkDays: 7,
  customerAccessDays: 400,
  commissionExcludeFeesBps: 0,
  suspendOnFullRefund: true,
  maxGuestsPerInvitation: 600,
  maxPhotos: 6,
  maxUploadMb: 8,
  allowMusic: true,
  allowPartySize: true,
  contactWhatsapp: "",
  orderInstructions: "تواصل معنا أو مع ممثلنا المعتمد، اختر التصميم وعدد المدعوين، وادفع نقداً يداً بيد. ستستلم رمز دخول خاص بدعوتك فوراً.",
};

export async function getSettings(q: Queryable): Promise<Settings> {
  const r = await q.query<{ value: Partial<Settings> }>(`select value from app_settings where key = 'general'`);
  return { ...DEFAULT_SETTINGS, ...(r.rows[0]?.value ?? {}) };
}

export async function saveSettings(q: Queryable, patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await getSettings(q)), ...patch };
  await q.query(
    `insert into app_settings(key, value) values ('general', $1)
     on conflict (key) do update set value = excluded.value, updated_at = now()`,
    [JSON.stringify(next)],
  );
  return next;
}

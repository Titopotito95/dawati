/**
 * Invitation content model shared by the server (DB JSON) and the client renderer.
 * All user-facing strings are Arabic; field names are English.
 */
export const EVENT_TYPES = ["wedding", "engagement", "katb", "party", "other"] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  wedding: "حفل زفاف",
  engagement: "حفل خطوبة",
  katb: "عقد قران",
  party: "حفلة",
  other: "مناسبة خاصة",
};

export interface InvitationPhoto {
  id: string;
  url: string;
  width?: number;
  height?: number;
}

export interface InvitationContent {
  eventType: EventType;
  groomName: string;
  brideName: string;
  /** For non-couple events (party/other) a single title line is used instead of names. */
  eventTitle: string;
  hostLine: string;
  showBismillah: boolean;
  openingLine: string;
  inviteLine: string;
  guestGreeting: string;
  initials: string;
  eventDate: string; // YYYY-MM-DD (local date of the event)
  eventTime: string; // HH:MM 24h
  timeNote: string;
  venueName: string;
  address: string;
  mapsUrl: string;
  welcomeMessage: string;
  customMessage: string;
  closingMessage: string;
  photos: InvitationPhoto[];
  musicUrl: string;
}

export const OPTIONAL_PAGES = ["welcome", "details", "venue", "photos", "message", "rsvp", "thanks"] as const;
export type PageKey = (typeof OPTIONAL_PAGES)[number];

export const PAGE_LABELS: Record<PageKey, string> = {
  welcome: "صفحة الترحيب",
  details: "تفاصيل الحفل",
  venue: "موقع الحفل",
  photos: "صور العروسين",
  message: "رسالة خاصة",
  rsvp: "تأكيد الحضور",
  thanks: "كلمة شكر",
};

export type PagesConfig = Record<PageKey, boolean>;

export interface InvitationSettings {
  allowPartySize: boolean;
  defaultMaxPartySize: number;
  rsvpEnabled: boolean;
}

export type RsvpStatus = "accepted" | "declined";

export interface GuestView {
  name: string;
  maxPartySize: number;
  rsvp: { status: RsvpStatus; partySize: number } | null;
  expiresAt: string;
}

export type ColorVariantKey = "ivory" | "white" | "champagne" | "blush";

export interface InvitationViewModel {
  renderer: string; // e.g. "pearl-lace@1"
  variant: ColorVariantKey;
  content: InvitationContent;
  pages: PagesConfig;
  settings: InvitationSettings;
  guest: GuestView | null;
  /** guest: real guest link; preview: customer preview; demo: public sample */
  mode: "guest" | "preview" | "demo";
  /** guest token is sent in the POST body (never as a query parameter) */
  guestToken?: string;
}

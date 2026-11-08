import type { InvitationContent, InvitationSettings, PagesConfig, InvitationViewModel } from "./types";

/** Starting content for a freshly provisioned workspace (editable placeholders, not real people). */
export function defaultContent(): InvitationContent {
  return {
    eventType: "wedding",
    groomName: "اسم العريس",
    brideName: "اسم العروس",
    eventTitle: "",
    hostLine: "",
    showBismillah: true,
    openingLine: "بكل الحب والسرور",
    inviteLine: "نتشرف بدعوتكم لحضور حفل زفاف",
    guestGreeting: "ضيفنا العزيز",
    initials: "",
    eventDate: "",
    eventTime: "20:00",
    timeNote: "",
    venueName: "",
    address: "",
    mapsUrl: "",
    welcomeMessage: "حضوركم يكمل فرحتنا، ويزيد ليلتنا جمالاً وبهجة",
    customMessage: "",
    closingMessage: "شكراً لكم، دمتم ودامت أفراحكم",
    photos: [],
    musicUrl: "",
  };
}

export function defaultPages(): PagesConfig {
  return { welcome: true, details: true, venue: true, photos: false, message: false, rsvp: true, thanks: true };
}

export function defaultSettings(): InvitationSettings {
  return { allowPartySize: false, defaultMaxPartySize: 1, rsvpEnabled: true };
}

/** Public sample data for theme previews (clearly fictional). */
export function sampleViewModel(variant: InvitationViewModel["variant"] = "white"): InvitationViewModel {
  return {
    renderer: "pearl-lace@1",
    variant,
    mode: "demo",
    content: {
      ...defaultContent(),
      groomName: "جلال",
      brideName: "سارة",
      initials: "ج س",
      eventDate: "2027-05-20",
      eventTime: "20:30",
      timeNote: "بعد صلاة العشاء",
      venueName: "قاعة اللؤلؤة للمناسبات",
      address: "طرابلس — طريق الشط",
      mapsUrl: "",
      customMessage: "",
    },
    pages: { ...defaultPages() },
    settings: { ...defaultSettings(), allowPartySize: true, defaultMaxPartySize: 3 },
    guest: { name: "الأستاذ أحمد وعائلته", maxPartySize: 3, rsvp: null, expiresAt: "" },
  };
}

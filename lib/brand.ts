/** Brand settings (overridable through environment variables at build time). */
export const BRAND = {
  name: process.env.NEXT_PUBLIC_BRAND_NAME || "دعوتي",
  tagline: "دعوتك... بداية حكاية جميلة",
  whatsapp: process.env.NEXT_PUBLIC_CONTACT_WHATSAPP || "",
};

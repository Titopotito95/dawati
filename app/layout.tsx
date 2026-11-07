import type { Metadata, Viewport } from "next";
import "@fontsource/cairo/400.css";
import "@fontsource/cairo/600.css";
import "@fontsource/cairo/700.css";
import "@fontsource/amiri/400.css";
import "@fontsource/amiri/700.css";
import "@fontsource/aref-ruqaa/400.css";
import "@fontsource/aref-ruqaa/700.css";
import "@fontsource/el-messiri/400.css";
import "@fontsource/el-messiri/600.css";
import "./globals.css";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = {
  title: { default: `${BRAND.name} — دعوات زفاف رقمية فاخرة`, template: `%s — ${BRAND.name}` },
  description: "دعوات زفاف ومناسبات رقمية فاخرة بتصاميم دانتيل ولؤلؤ تتفتح أمام ضيوفك كأنها حقيقية، مع روابط خاصة لكل ضيف وتأكيد حضور.",
  applicationName: BRAND.name,
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f2ded7",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}

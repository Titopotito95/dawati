import type { ReactNode } from "react";
import DashboardShell from "@/components/ui/DashboardShell";
import { requireCustomer } from "@/lib/auth";
import { logoutAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "لوحة دعوتي", robots: { index: false } };

const NAV = [
  { href: "/dashboard", label: "لوحة دعوتي", exact: true },
  { href: "/dashboard/edit", label: "تعديل الدعوة" },
  { href: "/dashboard/design", label: "تصميم الدعوة" },
  { href: "/dashboard/guests", label: "المدعوون" },
  { href: "/dashboard/links", label: "روابط الدعوات" },
  { href: "/dashboard/rsvp", label: "تأكيد الحضور" },
  { href: "/dashboard/preview", label: "معاينة الدعوة" },
  { href: "/dashboard/settings", label: "الإعدادات" },
];

export default async function Layout({ children }: { children: ReactNode }) {
  const { ws } = await requireCustomer();
  return (
    <DashboardShell
      title={ws.customerName ? `مرحباً ${ws.customerName}` : "لوحة دعوتي"}
      roleLabel="لوحة العميل"
      nav={NAV}
      homeHref="/dashboard"
      footer={
        <form action={logoutAction}>
          <button className="btn btn-ghost btn-sm" type="submit">تسجيل الخروج</button>
        </form>
      }
    >
      {children}
    </DashboardShell>
  );
}

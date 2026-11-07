import type { ReactNode } from "react";
import DashboardShell from "@/components/ui/DashboardShell";
import { requireOwner } from "@/lib/auth";
import { ownerLogoutAction } from "../actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "لوحة المالك", robots: { index: false } };

export default async function Layout({ children }: { children: ReactNode }) {
  const { username } = await requireOwner();
  return (
    <DashboardShell
      title="لوحة المالك"
      roleLabel={`المالك: ${username}`}
      homeHref="/owner/dashboard"
      nav={[
        { href: "/owner/dashboard", label: "نظرة عامة", exact: true },
        { href: "/owner/dashboard/customers", label: "العملاء" },
        { href: "/owner/dashboard/orders", label: "الطلبات" },
        { href: "/owner/dashboard/invitations", label: "الدعوات" },
        { href: "/owner/dashboard/themes", label: "القوالب" },
        { href: "/owner/dashboard/affiliates", label: "المسوقون" },
        { href: "/owner/dashboard/commissions", label: "العمولات" },
        { href: "/owner/dashboard/payments", label: "المدفوعات" },
        { href: "/owner/dashboard/settings", label: "الإعدادات" },
      ]}
      footer={
        <form action={ownerLogoutAction}>
          <button type="submit" className="btn btn-ghost btn-sm">تسجيل الخروج</button>
        </form>
      }
    >
      {children}
    </DashboardShell>
  );
}

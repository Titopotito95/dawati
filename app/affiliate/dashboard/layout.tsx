import type { ReactNode } from "react";
import DashboardShell from "@/components/ui/DashboardShell";
import { requireAffiliate } from "@/lib/auth";
import { logoutAffiliate } from "../actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "لوحة المسوق", robots: { index: false } };

export default async function Layout({ children }: { children: ReactNode }) {
  const { affiliate } = await requireAffiliate();
  return (
    <DashboardShell
      title={`أهلاً ${affiliate.name}`}
      roleLabel="لوحة المسوق"
      homeHref="/affiliate/dashboard"
      nav={[
        { href: "/affiliate/dashboard", label: "لوحة التحكم", exact: true },
        { href: "/affiliate/dashboard/sales", label: "مبيعاتي" },
        { href: "/affiliate/dashboard/commissions", label: "العمولات" },
        { href: "/affiliate/dashboard/link", label: "رابط الإحالة" },
        { href: "/affiliate/dashboard/orders", label: "الطلبات" },
        { href: "/affiliate/dashboard/payouts", label: "سجل الدفعات" },
      ]}
      footer={
        <form action={logoutAffiliate}>
          <button type="submit" className="btn btn-ghost btn-sm">تسجيل الخروج</button>
        </form>
      }
    >
      {children}
    </DashboardShell>
  );
}

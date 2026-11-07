import type { Metadata } from "next";
import { getDb } from "@/lib/db";
import { resolveGuestLink } from "@/lib/services/guests";
import type { InvitationViewModel } from "@/lib/invitation/types";
import GuestInvitation from "./GuestInvitation";
import { BRAND } from "@/lib/brand";

export const dynamic = "force-dynamic";

// Generic metadata only: link previews in WhatsApp must not reveal guest or couple names.
export const metadata: Metadata = {
  title: "دعوة خاصة",
  description: "لديك دعوة خاصة — افتحها من هاتفك",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
  openGraph: { title: "لديك دعوة خاصة", description: `دعوة رقمية من ${BRAND.name}`, images: ["/assets/og-invitation.jpg"] },
};

function StateCard({ title, body }: { title: string; body: string }) {
  return (
    <main className="inv-shell">
      <div className="card mx-4 max-w-sm p-8 text-center">
        <svg width="56" height="56" viewBox="0 0 40 40" className="mx-auto" aria-hidden="true">
          <ellipse cx="20" cy="20" rx="15" ry="18" fill="#f6eeea" stroke="#c9a49a" />
          <path d="M14 16l12 8M26 16l-12 8" stroke="#8a6157" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
        <h1 className="mt-4 font-[family-name:var(--font-display)] text-2xl font-semibold text-burgundy">{title}</h1>
        <p className="mt-3 leading-8 text-ink-soft">{body}</p>
      </div>
    </main>
  );
}

export default async function GuestPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const db = await getDb();
  const g = await resolveGuestLink(db, token);
  if (g.state === "expired") return <StateCard title="انتهت صلاحية رابط هذه الدعوة" body="يرجى التواصل مع أصحاب الدعوة للحصول على رابط جديد." />;
  if (g.state === "revoked") return <StateCard title="هذا الرابط لم يعد فعّالاً" body="تم استبدال هذا الرابط أو إلغاؤه. يرجى التواصل مع أصحاب الدعوة." />;
  if (g.state === "unavailable") return <StateCard title="الدعوة غير متاحة حالياً" body="هذه الدعوة متوقفة مؤقتاً. يرجى المحاولة لاحقاً." />;
  if (g.state !== "ok") return <StateCard title="الرابط غير صحيح" body="تأكد من فتح الرابط كاملاً كما وصلك." />;
  const vm: InvitationViewModel = {
    renderer: g.renderer,
    variant: g.variant,
    content: g.content,
    pages: g.pages,
    settings: g.settings,
    mode: "guest",
    guestToken: token,
    guest: { name: g.guestName, maxPartySize: g.maxPartySize, rsvp: g.rsvp, expiresAt: g.expiresAt },
  };
  return (
    <main className="inv-shell">
      <div className="inv-shell__stage">
        <GuestInvitation vm={vm} />
      </div>
    </main>
  );
}

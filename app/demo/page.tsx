import InvitationPlayer from "@/components/invitation/InvitationPlayer";
import { sampleViewModel } from "@/lib/invitation/defaults";
import type { ColorVariantKey } from "@/lib/invitation/types";

export const metadata = { title: "عرض تجريبي للدعوة", robots: { index: false } };

const VARIANTS: ColorVariantKey[] = ["ivory", "white", "champagne"];

export default async function DemoPage({ searchParams }: { searchParams: Promise<{ color?: string }> }) {
  const sp = await searchParams;
  const variant = VARIANTS.includes(sp.color as ColorVariantKey) ? (sp.color as ColorVariantKey) : "white";
  const vm = sampleViewModel(variant);
  return (
    <main className="inv-shell">
      <div className="inv-shell__stage">
        <InvitationPlayer vm={vm} badge="عرض تجريبي" />
      </div>
    </main>
  );
}

"use client";

/** Opens the native share sheet when available, otherwise WhatsApp's public share URL (no paid API). */
export default function WhatsAppShare({ text, url, label = "إرسال عبر واتساب", className = "btn btn-sm text-white bg-[#1f8f4e] hover:bg-[#187540]" }: { text: string; url: string; label?: string; className?: string }) {
  async function share() {
    const msg = `${text}\n${url}`;
    const nav = navigator as Navigator & { share?: (d: { text?: string; url?: string; title?: string }) => Promise<void> };
    if (nav.share && /Android|iPhone|iPad/i.test(navigator.userAgent)) {
      try {
        await nav.share({ text, url });
        return;
      } catch {
        /* user cancelled → fall through */
      }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank", "noopener,noreferrer");
  }
  return (
    <button type="button" onClick={share} className={className}>
      {label}
    </button>
  );
}

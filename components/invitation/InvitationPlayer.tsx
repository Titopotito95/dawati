"use client";

import dynamic from "next/dynamic";
import type { InvitationViewModel } from "@/lib/invitation/types";

/**
 * Theme renderer registry. Each theme version maps to its own client component, so new themes
 * can be added without touching payments, referrals, access tokens or RSVP logic.
 * Existing invitations keep the renderer key of the theme version they were created with.
 */
const RENDERERS = {
  "pearl-lace@1": dynamic(() => import("./pearl-lace/PearlLaceInvitation"), {
    ssr: false,
    loading: () => <div style={{ width: "100%", height: "100%", background: "#f2ded7" }} aria-busy="true" />,
  }),
  "pearl-lotus@1": dynamic(() => import("./pearl-lotus/PearlLotusInvitation"), {
    ssr: false,
    loading: () => <div style={{ width: "100%", height: "100%", background: "#f3e6e2" }} aria-busy="true" />,
  }),
} as const;

export type RendererKey = keyof typeof RENDERERS;
export const RENDERER_KEYS = Object.keys(RENDERERS) as RendererKey[];

export default function InvitationPlayer(props: {
  vm: InvitationViewModel;
  showcase?: boolean;
  badge?: string;
  onOpenStart?: () => void;
}) {
  const R = RENDERERS[props.vm.renderer as RendererKey];
  if (!R) {
    return (
      <div role="alert" style={{ padding: 24, textAlign: "center", fontFamily: "Cairo, sans-serif" }}>
        هذا التصميم غير متاح حالياً.
      </div>
    );
  }
  return <R {...props} />;
}

"use client";
import { useCallback, useRef } from "react";
import InvitationPlayer from "@/components/invitation/InvitationPlayer";
import type { InvitationViewModel } from "@/lib/invitation/types";

export default function GuestInvitation({ vm }: { vm: InvitationViewModel }) {
  const sent = useRef(false);
  // Count an "open" only after a human taps the seal (crawlers never run this).
  const onOpenStart = useCallback(() => {
    if (sent.current || !vm.guestToken) return;
    sent.current = true;
    fetch("/api/guest/open", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: vm.guestToken }),
      keepalive: true,
      credentials: "omit",
      referrerPolicy: "no-referrer",
    }).catch(() => undefined);
  }, [vm.guestToken]);
  return <InvitationPlayer vm={vm} onOpenStart={onOpenStart} />;
}

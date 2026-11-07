"use client";

import { useEffect, useRef } from "react";

/**
 * Animated landing-page background (layer behind the hero content).
 * Phones get the portrait composition, wider screens the widescreen one; the browser picks the
 * <source> by its media query. Muted + playsInline so iOS / Android allow autoplay; the still
 * frame behind it is only a fallback for when a device refuses autoplay (e.g. iPhone Low Power Mode).
 */
export default function HeroBackground() {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // React does not render the `muted` attribute on the server, so set it before playing (required by iOS autoplay).
    v.muted = true;
    v.defaultMuted = true;
    v.play().catch(() => undefined);
  }, []);

  return (
    <div className="hero-bg" aria-hidden="true">
      <div className="hero-bg__sticky">
        <div className="hero-bg__media">
          <video
            ref={ref}
            className="hero-bg__video"
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            disablePictureInPicture
            disableRemotePlayback
            tabIndex={-1}
          >
            <source src="/assets/hero/hero-mobile.mp4" type="video/mp4" media="(max-aspect-ratio: 1/1)" />
            <source src="/assets/hero/hero-desktop.mp4" type="video/mp4" />
          </video>
        </div>
        <div className="hero-bg__glow" />
      </div>
    </div>
  );
}

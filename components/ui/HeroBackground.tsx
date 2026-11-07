"use client";

import { useEffect, useRef } from "react";

/**
 * Animated landing-page background: sits at the very top of the page, behind the header and the
 * hero, and its bottom fades into the page colour (the page itself has the same colour).
 * Phones get the portrait composition, wider screens the widescreen one (picked by <source media>).
 * Muted + playsInline so iOS / Android allow autoplay; the still frame behind it is only a fallback.
 */
export default function HeroBackground() {
  const ref = useRef<HTMLVideoElement>(null);
  const wrap = useRef<HTMLDivElement>(null);

  // the see-through header turns solid once the video has scrolled away from under it
  useEffect(() => {
    const el = wrap.current;
    const header = document.querySelector<HTMLElement>(".site-header-overlay");
    if (!el || !header || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(([e]) => header.toggleAttribute("data-solid", !e.isIntersecting), {
      rootMargin: "-64px 0px 0px 0px",
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

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
    <div ref={wrap} className="hero-bg" aria-hidden="true">
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
    </div>
  );
}

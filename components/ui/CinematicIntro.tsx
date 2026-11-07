"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Home-page cinematic intro: the pre-recorded jewellery-box video plays once, full screen, on top of
 * the (already loaded) website; its crystal-light ending is completed by a short white overlay that
 * then fades away to reveal the page. Plays once per browser tab session, never on in-site navigation.
 *
 * Phones: the centre crop of the video zoomed to fill the screen (object-fit: cover, no bars).
 * Desktop: the full 16:9 video, full screen. Always with its sound: phones only allow sound to start
 * by itself when the browser permits it, otherwise it starts muted and the sound comes on at the
 * visitor's first touch, click or key press. Skipped for prefers-reduced-motion.
 */

const KEY = "dw_intro_seen";
const FLASH_START = 3.55; // s: the crystal light starts filling the frame
const FLASH_FULL = 4.4; // s: frame fully white (the video is 6.3 s, white from here to the end)
const FADE_MS = 2200; // slow fade from white into the website; the sound keeps playing meanwhile
const START_LIMIT_MS = 2500; // if the video has not started by then, the intro steps aside
const HARD_LIMIT_MS = 9000; // never keep the website covered longer than this
const GESTURES = ["pointerup", "touchend", "click", "keydown"];

declare global {
  interface Window {
    __dwIntro?: "play" | "skip" | "done";
    __dwIntroBlocked?: boolean;
  }
}

/* Runs while the HTML is parsed (before React loads), so the decision is made before the first paint:
   - already seen in this tab, or reduced motion → hidden at once;
   - otherwise start the video right away: with sound if allowed, else muted (autoplay rules);
   - a failsafe uncovers the website even if the scripts never load. */
const BOOT = `(function(){var d=document.documentElement,s,r=false;
try{s=sessionStorage.getItem("${KEY}")}catch(e){}
try{r=window.matchMedia("(prefers-reduced-motion: reduce)").matches}catch(e){}
if(s||r){window.__dwIntro="skip";d.classList.add("intro-done");return}
window.__dwIntro="play";try{sessionStorage.setItem("${KEY}","1")}catch(e){}
var v=document.getElementById("cinematic-intro-video");
if(v){var u=function(){v.muted=false;G.forEach(function(t){document.removeEventListener(t,u,true)})},G=${JSON.stringify(GESTURES)};
v.muted=false;var p=v.play();if(p&&p.catch)p.catch(function(){v.muted=true;G.forEach(function(t){document.addEventListener(t,u,true)});
var q=v.play();if(q&&q.catch)q.catch(function(){window.__dwIntroBlocked=true})})}
setTimeout(function(){d.classList.add("intro-done")},${HARD_LIMIT_MS + 500});})();`;

export default function CinematicIntro() {
  const [mounted, setMounted] = useState(
    () => typeof window === "undefined" || window.__dwIntro === "play" || window.__dwIntro === "skip",
  );
  const root = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const flash = useRef<HTMLDivElement>(null);
  const closeRef = useRef<(ms: number) => void>(() => undefined);

  useEffect(() => {
    if (!mounted) return;
    const el = root.current;
    const v = video.current;
    const w = flash.current;
    if (!el || !v || !w) return;
    const html = document.documentElement;
    if (window.__dwIntro !== "play") {
      window.__dwIntro = "done";
      setMounted(false);
      return;
    }

    let raf = 0;
    let finished = false;
    const timers: number[] = [];
    const block = (e: Event) => e.preventDefault(); // the page behind must not scroll during the intro
    el.addEventListener("wheel", block, { passive: false });
    el.addEventListener("touchmove", block, { passive: false });

    // fade the intro away; `letSoundFinish` keeps the (now invisible) video playing until its sound ends
    const close = (fadeMs: number, letSoundFinish = false) => {
      if (finished) return;
      finished = true;
      cancelAnimationFrame(raf);
      el.style.transition = `opacity ${fadeMs}ms cubic-bezier(0.45, 0, 0.25, 1)`;
      el.style.opacity = "0";
      el.style.pointerEvents = "none";
      const left = letSoundFinish && Number.isFinite(v.duration) ? (v.duration - v.currentTime) * 1000 + 150 : 0;
      timers.push(
        window.setTimeout(() => {
          v.pause();
          window.__dwIntro = "done";
          html.classList.add("intro-done");
          setMounted(false);
        }, Math.max(fadeMs, Math.min(left, 4000))),
      );
    };
    closeRef.current = close;

    const tick = () => {
      const t = v.currentTime;
      const k = Math.min(1, Math.max(0, (t - FLASH_START) / (FLASH_FULL - FLASH_START)));
      w.style.opacity = String(k * k * (3 - 2 * k));
      if (k > 0) el.setAttribute("data-flash", "");
      if (t >= FLASH_FULL || v.ended) {
        w.style.opacity = "1";
        close(FADE_MS, true);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const onEnded = () => {
      w.style.opacity = "1";
      close(FADE_MS);
    };
    const onError = () => close(400);
    const unmute = () => {
      if (v.muted) v.muted = false; // sound on at the first touch / click / key if autoplay started muted
    };
    v.addEventListener("ended", onEnded);
    v.addEventListener("error", onError);
    GESTURES.forEach((t) => document.addEventListener(t, unmute, true));

    if (window.__dwIntroBlocked) close(400); // autoplay refused (e.g. iPhone Low Power Mode)
    else if (v.paused && !v.ended) {
      v.play().catch(() => {
        v.muted = true;
        v.play().catch(() => close(400));
      });
    }

    const sinceLoad = performance.now();
    timers.push(
      window.setTimeout(() => {
        if (v.currentTime < 0.05) close(400); // still not playing (slow network): show the website
      }, Math.max(0, START_LIMIT_MS - sinceLoad)),
      window.setTimeout(() => {
        w.style.opacity = "1";
        close(FADE_MS);
      }, Math.max(0, HARD_LIMIT_MS - sinceLoad)),
    );

    return () => {
      cancelAnimationFrame(raf);
      timers.forEach((id) => clearTimeout(id));
      el.removeEventListener("wheel", block);
      el.removeEventListener("touchmove", block);
      v.removeEventListener("ended", onEnded);
      v.removeEventListener("error", onError);
      GESTURES.forEach((t) => document.removeEventListener(t, unmute, true));
    };
  }, [mounted]);

  if (!mounted) return null;

  return (
    <div ref={root} id="cinematic-intro" className="cinematic-intro">
      <video
        ref={video}
        id="cinematic-intro-video"
        className="cinematic-intro__video"
        playsInline
        preload="auto"
        disablePictureInPicture
        disableRemotePlayback
        tabIndex={-1}
        aria-hidden="true"
      >
        <source src="/assets/intro/intro-mobile.mp4" type="video/mp4" media="(max-aspect-ratio: 1/1)" />
        <source src="/assets/intro/intro-desktop.mp4" type="video/mp4" />
      </video>
      <div ref={flash} className="cinematic-intro__flash" aria-hidden="true" />
      <div className="cinematic-intro__controls">
        <button type="button" className="cinematic-intro__btn" onClick={() => closeRef.current(800)}>
          تخطي
        </button>
      </div>
      <script dangerouslySetInnerHTML={{ __html: BOOT }} />
      <noscript>
        <style>{".cinematic-intro{display:none!important}"}</style>
      </noscript>
    </div>
  );
}

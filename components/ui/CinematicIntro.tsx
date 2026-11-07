"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Home-page cinematic intro: the pre-recorded jewellery-box video plays once, full screen, on top of
 * the (already loaded) website; once its crystal light has turned the frame white, the intro fades
 * slowly into the page. Plays once per browser tab session, never on in-site navigation.
 *
 * Phones: the centre of the video, moderately zoomed. Desktop: the full 16:9 film, full screen.
 * Sound: browsers (iPhone Safari, Android Chrome and most first visits on a computer) only allow sound
 * after the visitor touches the page. So the intro first tries to start with sound by itself; where that
 * is not allowed it waits on its first frame with "المس لفتح الصندوق" and starts, with sound, on the
 * first touch. Skipped for prefers-reduced-motion.
 */

const KEY = "dw_intro_seen";
const FLASH_START = 3.55; // s: the crystal light starts filling the frame
const FLASH_FULL = 4.4; // s: frame fully white (the video is 6.3 s, white from here to the end)
const FADE_MS = 2200; // slow fade from white into the website; the sound keeps playing meanwhile
const START_LIMIT_MS = 3000; // asked to play but nothing moving after this: show the website
const PLAY_LIMIT_MS = 9000; // once playing, never cover the website longer than this

declare global {
  interface Window {
    __dwIntro?: "play" | "skip" | "done";
  }
}

/* Runs while the HTML is parsed (before React loads), so the decision is made before the first paint:
   - already seen in this tab, or reduced motion → hidden at once;
   - otherwise try to start with sound; if the browser refuses, show the "touch to open" screen, whose
     touch starts the video with sound;
   - failsafes uncover the website even if the page scripts never load. */
const BOOT = `(function(){var d=document.documentElement,s,r=false;
try{s=sessionStorage.getItem("${KEY}")}catch(e){}
try{r=window.matchMedia("(prefers-reduced-motion: reduce)").matches}catch(e){}
if(s||r){window.__dwIntro="skip";d.classList.add("intro-done");return}
window.__dwIntro="play";try{sessionStorage.setItem("${KEY}","1")}catch(e){}
var el=document.getElementById("cinematic-intro"),v=document.getElementById("cinematic-intro-video"),g=document.getElementById("cinematic-intro-gate");
var done=function(){d.classList.add("intro-done")},t=0;
if(!el||!v){done();return}
v.addEventListener("playing",function(){el.removeAttribute("data-gate");if(!t)t=setTimeout(done,${PLAY_LIMIT_MS + 1500})});
v.muted=false;var p=v.play();
if(p&&p.catch)p.catch(function(){el.setAttribute("data-gate","");
if(g)g.addEventListener("click",function(){v.muted=false;var q=v.play();if(q&&q.catch)q.catch(done)})});})();`;

export default function CinematicIntro() {
  const [mounted, setMounted] = useState(
    () => typeof window === "undefined" || window.__dwIntro === "play" || window.__dwIntro === "skip",
  );
  const root = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const flash = useRef<HTMLDivElement>(null);
  const gate = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<(ms: number) => void>(() => undefined);

  useEffect(() => {
    if (!mounted) return;
    const el = root.current;
    const v = video.current;
    const w = flash.current;
    const g = gate.current;
    if (!el || !v || !w || !g) return;
    const html = document.documentElement;
    if (window.__dwIntro !== "play") {
      window.__dwIntro = "done";
      setMounted(false);
      return;
    }

    let raf = 0;
    let finished = false;
    let playTimer = 0;
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
    const onPlaying = () => {
      if (!playTimer) {
        playTimer = window.setTimeout(() => {
          w.style.opacity = "1";
          close(FADE_MS);
        }, PLAY_LIMIT_MS);
      }
    };
    // after the "touch to open" touch: if the video still does not move (very slow network), step aside
    const onGate = () => {
      timers.push(window.setTimeout(() => v.currentTime < 0.05 && close(400), START_LIMIT_MS));
    };
    v.addEventListener("ended", onEnded);
    v.addEventListener("error", onError);
    v.addEventListener("playing", onPlaying);
    g.addEventListener("click", onGate);
    if (!v.paused) onPlaying();

    // started by itself but nothing moving (and no "touch to open" screen): show the website
    timers.push(
      window.setTimeout(() => {
        if (!el.hasAttribute("data-gate") && v.currentTime < 0.05) close(400);
      }, Math.max(0, START_LIMIT_MS - performance.now())),
    );

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(playTimer);
      timers.forEach((id) => clearTimeout(id));
      el.removeEventListener("wheel", block);
      el.removeEventListener("touchmove", block);
      v.removeEventListener("ended", onEnded);
      v.removeEventListener("error", onError);
      v.removeEventListener("playing", onPlaying);
      g.removeEventListener("click", onGate);
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
      <button ref={gate} id="cinematic-intro-gate" type="button" className="cinematic-intro__gate">
        <span className="cinematic-intro__gate-ring" aria-hidden="true" />
        <span className="cinematic-intro__gate-text">المس لفتح الصندوق</span>
      </button>
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

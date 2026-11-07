"use client";

import gsap from "gsap";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { InvitationViewModel } from "@/lib/invitation/types";
import { formatEventDate, formatEventTime } from "@/lib/invitation/format";
import manifestJson from "@/public/assets/themes/pearl-lotus/v1/manifest.json";
import { Countdown, downloadIcs, eventStartUtc, safeHttpsUrl, useReveal } from "./parts";
import ScratchReveal from "./ScratchReveal";
import "./pearl-lotus.css";

/**
 * Theme "Pearl Lotus" (pearl-lotus@1).
 * Closed pearl cover → the gold medallion spins like a top on its vertical axis (≈1.4 s) and settles
 * facing front → the cover parts along
 * its vertical gold seam into two sliding doors (≈1.05 s) → the first page, already underneath, is
 * revealed → the guest scrolls through four pages (invitation, date, venue, and a photo hidden under
 * a scratch layer in the gold oval). All wording and the photo come from the dashboard.
 */

type Phase = "loading" | "closed" | "opening" | "open";
type Box = { left: number; top: number; width: number; height: number };
const M = manifestJson as unknown as {
  cover: { w: number; h: number };
  seam: number;
  medallion: Box;
  page1: { w: number; h: number };
  page2: { w: number; h: number };
  page3: { w: number; h: number };
  reveal: Box;
};
const ASSET_ROOT = "/assets/themes/pearl-lotus/v1";
const VARIANTS = ["blush"]; // prepared colour variants (folders under ASSET_ROOT)
const pct = (n: number) => `${(n * 100).toFixed(4)}%`;

export interface PearlLotusProps {
  vm: InvitationViewModel;
  /** Landing / catalogue phone mock-up: opens by itself, scrolls through, then replays. */
  showcase?: boolean;
  /** Called once when the guest starts the opening (used for open tracking). */
  onOpenStart?: () => void;
  badge?: string;
}

function usePrefersReducedMotion() {
  const [r, setR] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setR(mq.matches);
    on();
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, []);
  return r;
}

/** Runs `cb` once the home-page cinematic intro has finished (at once when there is none). */
function afterIntro(cb: () => void): () => void {
  const html = document.documentElement;
  if (!document.getElementById("cinematic-intro") || html.classList.contains("intro-done")) {
    cb();
    return () => undefined;
  }
  let done = false;
  const mo = new MutationObserver(() => {
    if (!done && html.classList.contains("intro-done")) {
      done = true;
      mo.disconnect();
      cb();
    }
  });
  mo.observe(html, { attributes: true, attributeFilter: ["class"] });
  return () => {
    done = true;
    mo.disconnect();
  };
}

/** The medallion artwork; rendered in the spinner and (static) in each door. */
function Medal({ base, fill }: { base: string; fill?: boolean }) {
  return (
    <div className={`lt-medal${fill ? " lt-medal-fill" : ""}`}>
      <img src={`${base}/medallion.webp`} alt="" draggable={false} />
    </div>
  );
}

export default function PearlLotusInvitation({ vm, showcase = false, onOpenStart, badge }: PearlLotusProps) {
  const c = vm.content;
  const p = vm.pages;
  const variant = VARIANTS.includes(vm.variant) ? vm.variant : VARIANTS[0];
  const base = `${ASSET_ROOT}/${variant}`;
  const reduced = usePrefersReducedMotion();

  const rootRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const coverRef = useRef<HTMLDivElement>(null);
  const shadeRef = useRef<HTMLDivElement>(null);
  const doorL = useRef<HTMLDivElement>(null);
  const doorR = useRef<HTMLDivElement>(null);
  const spinRef = useRef<HTMLDivElement>(null);
  const spin3dRef = useRef<HTMLDivElement>(null);
  const hintRef = useRef<HTMLParagraphElement>(null);
  const tlRef = useRef<gsap.core.Timeline | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const phaseRef = useRef<Phase>("loading");
  phaseRef.current = phase;
  const [music, setMusic] = useState(false);

  const couple = !(c.eventType === "party" || c.eventType === "other") || !c.eventTitle;
  const date = useMemo(() => formatEventDate(c.eventDate), [c.eventDate]);
  const time = formatEventTime(c.eventTime);
  const start = useMemo(() => eventStartUtc(c.eventDate, c.eventTime), [c.eventDate, c.eventTime]);
  const maps = c.mapsUrl ? safeHttpsUrl(c.mapsUrl) : null;
  const showVenue = p.venue && !!(c.venueName || c.address);
  // page 4 photo: the customer's first uploaded photo; the sample photo only in demos / previews
  const customerPhoto = c.photos?.[0]?.url;
  const revealPhoto = customerPhoto || (vm.mode !== "guest" ? `${ASSET_ROOT}/demo-reveal.webp` : null);
  const [revealKey, setRevealKey] = useState(0);

  // ---------- preload the cover and the first page, then show the closed invitation ----------
  useEffect(() => {
    let alive = true;
    const ready = () => alive && setPhase((ph) => (ph === "loading" ? "closed" : ph));
    const load = (src: string) =>
      new Promise<void>((res) => {
        const i = new Image();
        i.onload = i.onerror = () => res();
        i.src = src;
      });
    Promise.all(["cover-base", "medallion", "page1"].map((n) => load(`${base}/${n}.webp`))).then(ready);
    const t = window.setTimeout(ready, 5000);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [base]);

  useReveal(scrollRef, phase === "open");

  const finish = useCallback(() => {
    tlRef.current = null;
    setPhase("open");
  }, []);

  const startMusic = useCallback(() => {
    if (showcase || !c.musicUrl) return;
    if (!audioRef.current) {
      audioRef.current = new Audio(c.musicUrl);
      audioRef.current.loop = true;
    }
    audioRef.current.play().then(() => setMusic(true)).catch(() => setMusic(false));
  }, [showcase, c.musicUrl]);

  const buildTimeline = useCallback(() => {
    const spin = spinRef.current!;
    const spin3d = spin3dRef.current!;
    const cover = coverRef.current!;
    const sheens = spin.querySelectorAll<HTMLElement>(".lt-sheen");
    const sheenIns = spin.querySelectorAll<HTMLElement>(".lt-sheen-in");
    const statics = cover.querySelectorAll<HTMLElement>(".lt-door .lt-medal");
    const shadows = cover.querySelectorAll<HTMLElement>(".lt-door-shadow");
    const words = rootRef.current!.querySelectorAll<HTMLElement>(".lt-p1 .lt-rv");
    let lastR = 0;
    let lastT = performance.now();
    const tl = gsap.timeline();
    gsap.set(words, { autoAlpha: 0, y: 14 });
    gsap.set(spin3d, { transformPerspective: 1100, rotationY: 0 });
    tl.to(hintRef.current, { autoAlpha: 0, duration: 0.25 }, 0);
    // 1) medallion spins like a top / Beyblade on its vertical axis: quick spin-up, fast turns,
    //    smooth slow-down, ending exactly face-on (4 full turns)
    tl.to(
      spin3d,
      {
        rotationY: 1440,
        duration: 1.4,
        ease: "power3.inOut",
        onUpdate: () => {
          const r = Number(gsap.getProperty(spin3d, "rotationY")) || 0;
          const now = performance.now();
          const v = Math.abs(r - lastR) / Math.max(1, now - lastT); // deg per ms
          lastR = r;
          lastT = now;
          const th = ((r % 360) + 360) % 360;
          const face = th <= 90 ? th : th < 270 ? th - 180 : th - 360; // visible side's angle, -90..90
          const rad = (face * Math.PI) / 180;
          const glint = Math.pow(Math.max(0, Math.cos(rad - 0.35)), 10); // light catching the gold
          gsap.set(sheenIns, { xPercent: Math.sin(rad) * 70 });
          spin.style.filter = `blur(${Math.min(1.3, v * 0.3).toFixed(2)}px) brightness(${(1 + 0.22 * glint).toFixed(3)}) drop-shadow(0 ${(3 + v * 1.4).toFixed(1)}px ${(6 + v * 2.2).toFixed(1)}px rgba(92,58,34,0.3))`;
        },
      },
      0.08,
    );
    tl.to(sheens, { opacity: 0.85, duration: 0.3, ease: "power1.out" }, 0.1);
    tl.to(sheens, { opacity: 0, duration: 0.45, ease: "power1.in" }, 1.05);
    // 2) hand the medallion over to the two doors (identical pixels, so nothing visibly changes)
    tl.call(
      () => {
        spin.style.filter = "";
        spin.style.visibility = "hidden";
        statics.forEach((e) => (e.style.visibility = "visible"));
      },
      undefined,
      1.52,
    );
    // 3) sliding doors along the seam, fully out of view
    const ease = "power3.inOut";
    tl.to(doorL.current, { xPercent: -(M.seam * 100 + 6), duration: 1.05, ease }, 1.56);
    tl.to(doorR.current, { xPercent: (1 - M.seam) * 100 + 6, duration: 1.05, ease }, 1.56);
    tl.to(shadows, { opacity: 1, duration: 0.3, ease: "power1.out" }, 1.56);
    tl.to(shadeRef.current, { opacity: 0, duration: 1.0, ease: "power1.out" }, 1.6);
    // 4) the first page's words appear
    tl.to(words, { autoAlpha: 1, y: 0, duration: 0.7, stagger: 0.08, ease: "power2.out" }, 2.05);
    return tl;
  }, []);

  const open = useCallback(() => {
    if (phaseRef.current !== "closed") return;
    onOpenStart?.();
    startMusic();
    setPhase("opening");
    if (reduced) {
      gsap.to(coverRef.current, { opacity: 0, duration: 0.45, onComplete: finish });
      return;
    }
    const tl = buildTimeline();
    tl.eventCallback("onComplete", finish);
    tlRef.current = tl;
  }, [buildTimeline, finish, onOpenStart, reduced, startMusic]);

  const replay = useCallback(() => {
    tlRef.current?.kill();
    tlRef.current = null;
    const root = rootRef.current;
    if (root) {
      gsap.set(root.querySelectorAll(".lt-rv"), { clearProps: "opacity,visibility,transform" });
      root.querySelectorAll(".lt-in").forEach((e) => e.classList.remove("lt-in"));
    }
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
    setRevealKey((k) => k + 1);
    setPhase("closed");
  }, []);

  const toggleMusic = useCallback(() => {
    const a = audioRef.current;
    if (!a) return startMusic();
    if (a.paused) a.play().then(() => setMusic(true)).catch(() => undefined);
    else {
      a.pause();
      setMusic(false);
    }
  }, [startMusic]);

  useEffect(() => () => {
    tlRef.current?.kill();
    audioRef.current?.pause();
  }, []);

  // ---------- showcase (catalogue phone): opens by itself, scrolls through, replays ----------
  useEffect(() => {
    if (!showcase) return;
    let t1 = 0;
    let tw: gsap.core.Tween | null = null;
    let stopWait = () => undefined as void;
    if (phase === "closed") stopWait = afterIntro(() => (t1 = window.setTimeout(open, 1800)));
    if (phase === "open" && !reduced) {
      t1 = window.setTimeout(() => {
        const sc = scrollRef.current;
        if (!sc) return;
        tw = gsap.to(sc, {
          scrollTop: sc.scrollHeight - sc.clientHeight,
          duration: 16,
          ease: "sine.inOut",
          onComplete: () => {
            t1 = window.setTimeout(replay, 2500);
          },
        });
      }, 1800);
    }
    return () => {
      stopWait();
      clearTimeout(t1);
      tw?.kill();
    };
  }, [showcase, phase, open, replay, reduced]);

  const vars = {
    "--seam": pct(M.seam),
    "--mx": pct(M.medallion.left),
    "--my": pct(M.medallion.top),
    "--mw": pct(M.medallion.width),
    "--mh": pct(M.medallion.height),
    "--cover-ar": String(M.cover.w / M.cover.h),
  } as CSSProperties;
  const page = (n: 1 | 2 | 3) => {
    const s = M[`page${n}` as const];
    return <img className="lt-art" src={`${base}/page${n}.webp`} width={s.w} height={s.h} alt="" draggable={false} decoding="async" />;
  };

  return (
    <div ref={rootRef} className="lt-root" data-phase={phase} data-showcase={showcase || undefined} style={vars} lang="ar" dir="rtl">
      {badge ? <div className="lt-badge">{badge}</div> : null}

      {/* ---------------- the three pages (already in place under the closed cover) ---------------- */}
      <div ref={scrollRef} className="lt-scroll" aria-hidden={phase !== "open"}>
        <section className="lt-page lt-p1">
          {page(1)}
          <div className="lt-content">
            {c.showBismillah ? <p className="lt-bismillah lt-rv">بسم الله الرحمن الرحيم</p> : null}
            {c.hostLine ? <p className="lt-line lt-line-sm lt-rv">{c.hostLine}</p> : null}
            {c.openingLine ? <p className="lt-line lt-rv">{c.openingLine}</p> : null}
            {c.inviteLine ? <p className="lt-line lt-rv">{c.inviteLine}</p> : null}
            <div className="lt-names lt-rv">
              {couple ? (
                <>
                  <span className="lt-name">{c.groomName}</span>
                  <span className="lt-and">و</span>
                  <span className="lt-name">{c.brideName}</span>
                </>
              ) : (
                <span className="lt-name">{c.eventTitle}</span>
              )}
            </div>
            {vm.guest?.name ? (
              <div className="lt-guest lt-rv">
                <span className="lt-guest-label">{c.guestGreeting}</span>
                <span className="lt-guest-name">{vm.guest.name}</span>
              </div>
            ) : null}
            <span className="lt-cue lt-rv" aria-hidden="true">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M3 6l5 5 5-5" />
              </svg>
            </span>
          </div>
        </section>

        <section className="lt-page lt-p2">
          {page(2)}
          <div className="lt-content" data-reveal>
            <h2 className="lt-title lt-rv">موعد الحفل</h2>
            {p.details && date ? (
              <div className="lt-date lt-rv" style={{ ["--i" as string]: 1 }}>
                <span className="lt-date-side">{date.day}</span>
                <span className="lt-date-num">{date.date}</span>
                <span className="lt-date-side">
                  {date.month}
                  <br />
                  {date.year}
                </span>
              </div>
            ) : (
              <p className="lt-text lt-rv">سيتم تحديد الموعد قريباً</p>
            )}
            {p.details && time ? (
              <p className="lt-text lt-rv" style={{ ["--i" as string]: 2 }}>
                الساعة {time}
                {c.timeNote ? ` — ${c.timeNote}` : ""}
              </p>
            ) : null}
            {p.details && start ? (
              <div className="lt-rv" style={{ ["--i" as string]: 3 }}>
                <Countdown target={start} />
                <button type="button" className="lt-btn" onClick={() => downloadIcs(vm, start)}>
                  أضف إلى التقويم
                </button>
              </div>
            ) : null}
            {p.welcome && c.welcomeMessage ? (
              <p className="lt-text lt-text-soft lt-rv" style={{ ["--i" as string]: 4 }}>
                {c.welcomeMessage}
              </p>
            ) : null}
          </div>
        </section>

        <section className="lt-page lt-p3">
          {page(2)}
          <div className="lt-content" data-reveal>
            {showVenue ? (
              <>
                <h2 className="lt-title lt-rv">موقع الحفل</h2>
                {c.venueName ? <p className="lt-script lt-rv" style={{ ["--i" as string]: 1 }}>{c.venueName}</p> : null}
                {c.address ? <p className="lt-text lt-rv" style={{ ["--i" as string]: 2 }}>{c.address}</p> : null}
                {maps ? (
                  <a className="lt-btn lt-btn-solid lt-rv" style={{ ["--i" as string]: 3 }} href={maps} target="_blank" rel="noopener noreferrer">
                    فتح الموقع على الخريطة
                  </a>
                ) : null}
              </>
            ) : null}
            {p.message && c.customMessage ? (
              <p className="lt-text lt-text-soft lt-rv" style={{ ["--i" as string]: 4 }}>
                {c.customMessage}
              </p>
            ) : null}
            {!showVenue && !(p.message && c.customMessage) ? (
              <p className="lt-script lt-rv">{couple ? `${c.groomName} و ${c.brideName}` : c.eventTitle}</p>
            ) : null}
            <ul className="lt-rules lt-rv" style={{ ["--i" as string]: 5 }}>
              <li>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
                  <circle cx="12" cy="13" r="3.4" />
                  <path d="M3.5 3.5l17 17" />
                </svg>
                <span>يرجى احترام الخصوصية بعدم التصوير</span>
              </li>
              <li>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="5.2" r="2.2" />
                  <path d="M12 8.4v5.8M8.4 10.6h7.2M12 14.2l-2.6 5.3M12 14.2l2.6 5.3" />
                  <path d="M3.5 3.5l17 17" />
                </svg>
                <span>ممنوع اصطحاب الأطفال</span>
              </li>
            </ul>
          </div>
        </section>

        <section className="lt-page lt-p4">
          {page(3)}
          {revealPhoto ? (
            <ScratchReveal
              key={revealKey}
              art={`${base}/page3.webp`}
              frame={`${base}/page3-frame.webp`}
              box={M.reveal}
              photo={revealPhoto}
              interactive={!showcase}
              autoDemo={showcase}
              reduced={reduced}
            />
          ) : (
            <div className="lt-content lt-oval" data-reveal>
              <p className="lt-script lt-rv">{couple ? `${c.groomName} و ${c.brideName}` : c.eventTitle}</p>
            </div>
          )}
          <div className="lt-content lt-lower" data-reveal>
            {p.thanks && c.closingMessage ? <p className="lt-text lt-rv">{c.closingMessage}</p> : null}
          </div>
        </section>

        <footer className="lt-end" data-reveal>
          <p className="lt-script lt-script-sm lt-rv" style={{ ["--i" as string]: 2 }}>
            {couple ? `${c.groomName} و ${c.brideName}` : c.eventTitle}
          </p>
          {date ? (
            <p className="lt-note lt-rv" style={{ ["--i" as string]: 3 }}>
              {date.full}
            </p>
          ) : null}
          <button type="button" className="lt-btn lt-rv" style={{ ["--i" as string]: 4 }} onClick={replay}>
            إعادة فتح الدعوة
          </button>
        </footer>
      </div>

      {/* ---------------- closed cover: spinning medallion + two sliding doors ---------------- */}
      {phase !== "open" && phase !== "loading" ? (
        <div
          ref={coverRef}
          className="lt-cover"
          role="button"
          tabIndex={phase === "closed" ? 0 : -1}
          aria-label="المس لفتح الدعوة"
          onClick={open}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              open();
            }
          }}
        >
          <div ref={shadeRef} className="lt-shade" aria-hidden="true" />
          <div className="lt-stage" aria-hidden="true">
            {(["l", "r"] as const).map((side) => (
              <div key={side} ref={side === "l" ? doorL : doorR} className={`lt-door lt-door-${side}`}>
                <div className="lt-door-art">
                  <img src={`${base}/cover-base.webp`} alt="" draggable={false} />
                  <Medal base={base} />
                </div>
                <div className="lt-door-shadow" />
              </div>
            ))}
            <div ref={spinRef} className="lt-spin">
              <div ref={spin3dRef} className="lt-spin3d">
                {(["front", "back"] as const).map((f) => (
                  <div key={f} className={`lt-face lt-face-${f}`}>
                    <Medal base={base} fill />
                    <div className="lt-sheen" style={{ WebkitMaskImage: `url(${base}/medallion.webp)`, maskImage: `url(${base}/medallion.webp)` }}>
                      <div className="lt-sheen-in" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <p ref={hintRef} className="lt-hint">
              المس لفتح الدعوة
            </p>
          </div>
        </div>
      ) : null}

      {phase === "open" ? (
        <div className="lt-controls">
          <button type="button" className="lt-fab" aria-label="إعادة فتح الدعوة" onClick={replay}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 12a9 9 0 1 0 3-6.7" />
              <path d="M3 4v5h5" />
            </svg>
          </button>
          {c.musicUrl && !showcase ? (
            <button type="button" className="lt-fab" aria-label={music ? "إيقاف الموسيقى" : "تشغيل الموسيقى"} aria-pressed={music} onClick={toggleMusic}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 18V5l11-2v13" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="17" cy="16" r="3" />
                {music ? null : <path d="M3 3l18 18" />}
              </svg>
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

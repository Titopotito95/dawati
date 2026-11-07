"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import gsap from "gsap";
import manifestJson from "@/public/assets/themes/pearl-lace/v1/manifest.json";
import type { InvitationViewModel } from "@/lib/invitation/types";
import { formatEventDate } from "@/lib/invitation/format";
import { PEARL_LACE_TIMELINE as T, type FlapName } from "./timeline";
import { Sections } from "./sections";
import "./pearl-lace.css";

type Box = { x: number; y: number; w: number; h: number };
type Glint = { x: number; y: number; s: number; layer?: string };
type Manifest = {
  source: { width: number; height: number };
  card: { aspect: number };
  layers: Record<string, Box>;
  glints: Glint[];
  cardGlints: Glint[];
};
const M = manifestJson as unknown as Manifest;
const ENV_ASPECT = M.source.width / M.source.height;
const CARD_ASPECT = M.card.aspect;
const FLAPS: FlapName[] = ["bottom", "left", "right", "top"]; // DOM order = closed stacking order
const ASSET_ROOT = "/assets/themes/pearl-lace/v1";

type Phase = "loading" | "closed" | "opening" | "open";

export interface PearlLaceProps {
  vm: InvitationViewModel;
  /** Landing-page phone mock-up: opens by itself, scrolls through, then replays. */
  showcase?: boolean;
  /** Called once when the guest starts the opening (used for open tracking). */
  onOpenStart?: () => void;
  badge?: string;
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const set = () => setReduced(mq.matches);
    set();
    mq.addEventListener?.("change", set);
    return () => mq.removeEventListener?.("change", set);
  }, []);
  return reduced;
}

const pct = (n: number) => `${(n * 100).toFixed(4)}%`;

/** Deterministic pseudo-random so sparkle timing is stable between renders. */
function rnd(i: number, salt: number) {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/** Crystal-like glints on pearls and beads: a soft core with a four-point star flare. */
function Sparkles({ points, scale = 1, salt = 1 }: { points: Glint[]; scale?: number; salt?: number }) {
  return (
    <>
      {points.map((g, i) => {
        const size = (3.4 + g.s * 5) * scale;
        const style = {
          left: pct(g.x),
          top: pct(g.y),
          ["--s" as string]: `${size.toFixed(2)}cqw`,
          ["--d" as string]: `${(3.2 + rnd(i, salt) * 3.4).toFixed(2)}s`,
          ["--delay" as string]: `${(-rnd(i, salt + 3) * 6).toFixed(2)}s`,
          ["--r" as string]: `${Math.round(rnd(i, salt + 7) * 40)}deg`,
        } as CSSProperties;
        return <i key={i} className="pl-spark" style={style} />;
      })}
    </>
  );
}

export default function PearlLaceInvitation({ vm, showcase = false, onOpenStart, badge }: PearlLaceProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const vignetteRef = useRef<HTMLDivElement>(null);
  const interiorRef = useRef<HTMLDivElement>(null);
  const bloomRef = useRef<HTMLDivElement>(null);
  const edgeRefs = useRef<Record<FlapName, HTMLDivElement | null>>({ top: null, left: null, right: null, bottom: null });
  const gapsRef = useRef<HTMLImageElement>(null);
  const sealRef = useRef<HTMLDivElement>(null); // animated seal (press / release)
  const sealTopRef = useRef<HTMLDivElement>(null); // top-layer holder that follows the flap tip
  const anchorRef = useRef<HTMLElement>(null); // point on the top flap where the seal is attached
  const sealExit = useRef({ y: 0 }); // extra upward travel as the seal leaves through the top edge
  const hintRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const flapRefs = useRef<Record<FlapName, HTMLDivElement | null>>({ top: null, left: null, right: null, bottom: null });
  const tlRef = useRef<gsap.core.Timeline | null>(null);
  const idleRef = useRef<gsap.core.Timeline | null>(null);
  const textTlRef = useRef<gsap.core.Timeline | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [assetsReady, setAssetsReady] = useState(false);
  const [music, setMusic] = useState(false);
  const reduced = usePrefersReducedMotion();
  const phaseRef = useRef<Phase>("loading");
  phaseRef.current = phase;

  // ---------- measure container ----------
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) setSize((s) => (s && Math.abs(s.w - r.width) < 1 && Math.abs(s.h - r.height) < 1 ? s : { w: r.width, h: r.height }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ---------- geometry: envelope and card both COVER the screen, like the reference video ----------
  const geo = useMemo(() => {
    if (!size) return null;
    const { w: cw, h: ch } = size;
    const envH = Math.max(ch, cw / ENV_ASPECT);
    const envW = envH * ENV_ASPECT;
    const cardH = Math.max(ch, cw / CARD_ASPECT);
    const cardW = cardH * CARD_ASPECT;
    return { cw, ch, envW, envH, cardW, cardH, persp: ch * T.perspective };
  }, [size]);

  const dpr = typeof window !== "undefined" ? Math.min(window.devicePixelRatio || 1, 3) : 2;
  const sizeKey = geo && geo.envW * dpr > 760 ? "lg" : "sm";
  const base = `${ASSET_ROOT}/${vm.variant}/${sizeKey}`;

  // ---------- preload & decode critical layers ----------
  useEffect(() => {
    if (!geo) return;
    let cancelled = false;
    setAssetsReady(false);
    const urls = [...FLAPS.map((f) => `${base}/flap-${f}.webp`), `${base}/seal.webp`, `${base}/gaps.webp`, `${base}/card.webp`];
    const decode = (u: string) =>
      new Promise<void>((resolve) => {
        const img = new Image();
        img.decoding = "async";
        img.src = u;
        const done = () => resolve();
        if (img.decode) img.decode().then(done, done);
        else {
          img.onload = done;
          img.onerror = done;
        }
      });
    Promise.all(urls.map(decode)).then(() => {
      if (!cancelled) setAssetsReady(true);
    });
    const warm = new Image();
    warm.src = `${base}/lace-band.webp`;
    return () => {
      cancelled = true;
    };
  }, [base, geo]);

  useEffect(() => {
    if (assetsReady && phaseRef.current === "loading") setPhase("closed");
  }, [assetsReady]);

  // ---------- light & shadow follow each flap's angle every frame ----------
  const updateLighting = useCallback(() => {
    for (const f of FLAPS) {
      const el = flapRefs.current[f];
      if (!el) continue;
      const prop = f === "top" || f === "bottom" ? "rotationX" : "rotationY";
      const a = Math.abs(Number(gsap.getProperty(el, prop)) || 0);
      const p = Math.min(1, a / 86);
      const r = (Math.min(a, 90) * Math.PI) / 180;
      const k = T.flaps[f].light;
      const shade = el.querySelector<HTMLElement>(".pl-shade");
      const lit = el.querySelector<HTMLElement>(".pl-lit");
      const sheen = el.querySelector<HTMLElement>(".pl-sheen");
      if (shade) shade.style.opacity = (Math.max(0, k) * Math.sin(r)).toFixed(3);
      if (lit) lit.style.opacity = (Math.max(0, -k) * Math.sin(r) * 2.2).toFixed(3);
      if (sheen) {
        sheen.style.opacity = (0.55 * Math.sin(Math.PI * p)).toFixed(3);
        sheen.style.backgroundPosition = `0% ${(p * 100).toFixed(1)}%`;
      }
      // the folding flap shades the card along its hinge edge, strongest mid-fold
      const edge = edgeRefs.current[f];
      if (edge) edge.style.opacity = (0.75 * Math.sin(Math.PI * p)).toFixed(3);
    }
  }, []);

  // ---------- the seal lives on its own TOP layer (never under any flap) ----------
  // Every frame it is placed at the screen position of its attachment point on the top flap,
  // measured from the real 3D transform, so it rides the flap like the reference video.
  const positionSeal = useCallback(() => {
    const a = anchorRef.current;
    const holder = sealTopRef.current;
    const scene = sceneRef.current;
    if (!a || !holder || !scene || !geo) return;
    const ar = a.getBoundingClientRect();
    const sr = scene.getBoundingClientRect();
    const w = geo.envW * M.layers["seal"].w;
    const h = geo.envH * M.layers["seal"].h;
    const x = ar.left + ar.width / 2 - sr.left - w / 2;
    const y = ar.top + ar.height / 2 - sr.top - h * 0.12 + sealExit.current.y;
    const camScale = cameraRef.current ? Number(gsap.getProperty(cameraRef.current, "scale")) || 1 : 1;
    holder.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) scale(${camScale.toFixed(4)})`;
  }, [geo]);

  useEffect(() => {
    if (phase === "open" || phase === "loading") return;
    positionSeal();
    gsap.ticker.add(positionSeal);
    return () => gsap.ticker.remove(positionSeal);
  }, [phase, positionSeal]);

  // ---------- build the master timeline ----------
  const buildTimeline = useCallback(() => {
    if (!geo) return null;
    tlRef.current?.kill();
    const cam = cameraRef.current!;
    const card = cardRef.current!;
    const seal = sealRef.current!;
    const gaps = gapsRef.current!;
    const hint = hintRef.current;
    const flaps = flapRefs.current;

    gsap.set(cam, { rotationX: 0, rotationY: 0, scale: 1, z: 0, transformOrigin: "50% 50%" });
    gsap.set(card, { scale: T.card.fromScale, transformOrigin: "50% 50%" });
    gsap.set(vignetteRef.current, { opacity: T.light.vignetteFrom });
    gsap.set(interiorRef.current, { opacity: T.light.shadowFrom });
    gsap.set(bloomRef.current, { opacity: 0 });
    gsap.set(gaps, { z: 1.2, autoAlpha: 1, scale: 1, transformOrigin: "50% 50%" });
    gsap.set(seal, { scale: 1, transformOrigin: "50% 12%" });
    gsap.set(sealTopRef.current, { opacity: 1 });
    sealExit.current.y = 0;
    if (hint) gsap.set(hint, { autoAlpha: 1 });
    for (const f of FLAPS) {
      const cfg = T.flaps[f];
      gsap.set(flaps[f], { z: cfg.z, rotationX: 0, rotationY: 0, autoAlpha: 1, transformOrigin: cfg.origin });
    }

    const tl = gsap.timeline({ paused: true, onUpdate: updateLighting, onComplete: () => finishRef.current() });
    tl.addLabel("seal", 0)
      .to(seal, { scale: T.seal.pressScale, duration: T.seal.pressDur, ease: "power2.in" }, 0)
      .to(seal, { scale: T.seal.liftScale, duration: T.seal.releaseDur, ease: T.seal.ease }, T.seal.pressDur)
      .to(seal, { scale: 1, duration: 0.8, ease: "sine.inOut" }, T.seal.pressDur + T.seal.releaseDur);
    if (hint) tl.to(hint, { autoAlpha: 0, duration: 0.3, ease: "power1.out" }, 0);
    tl.addLabel("tulle", T.tulle.start).to(gaps, { autoAlpha: 0, duration: T.tulle.dur, ease: "sine.inOut" }, T.tulle.start);
    for (const f of ["top", "left", "right", "bottom"] as FlapName[]) {
      const cfg = T.flaps[f];
      const prop = f === "top" || f === "bottom" ? "rotationX" : "rotationY";
      tl.addLabel(`flap-${f}`, cfg.start).to(flaps[f], { [prop]: cfg.angle, duration: cfg.dur, ease: cfg.ease }, cfg.start);
    }
    // the folded strips and the seal dissolve together at the edges
    const faces = FLAPS.map((f) => flaps[f]?.querySelector(".pl-face")).filter(Boolean);
    gsap.set(faces, { opacity: 1 });
    tl.to(faces, { opacity: 0, duration: T.flapsFade.dur, ease: "sine.in" }, T.flapsFade.start);
    // like the reference video, the seal keeps travelling up and leaves through the top edge
    tl.to(sealExit.current, { y: -geo.ch * T.sealExit.distance, duration: T.sealExit.dur, ease: "power2.in" }, T.sealExit.start)
      .to(sealTopRef.current, { opacity: 0, duration: T.sealExit.dur * 0.8, ease: "sine.in" }, T.sealExit.start + T.sealExit.dur * 0.2);
    tl.addLabel("camera", T.camera.pushStart)
      .to(cam, { scale: T.camera.pushScale, duration: T.camera.pushDur, ease: "sine.inOut" }, T.camera.pushStart)
      .to(cam, { scale: 1, duration: T.camera.returnDur, ease: "sine.out" }, T.camera.pushStart + T.camera.pushDur);
    tl.addLabel("card", T.card.riseStart)
      .to(card, { scale: 1, duration: T.card.riseDur, ease: "power2.out" }, T.card.riseStart)
      .to(interiorRef.current, { opacity: 0, duration: T.light.shadowDur, ease: "sine.in" }, T.light.shadowStart)
      .to(vignetteRef.current, { opacity: 0, duration: T.light.vignetteDur, ease: "sine.inOut" }, T.light.vignetteStart)
      .to(bloomRef.current, { opacity: T.light.bloomPeak, duration: T.light.bloomUp, ease: "sine.out" }, T.light.bloomStart)
      .to(bloomRef.current, { opacity: 0, duration: T.light.bloomDown, ease: "sine.inOut" }, T.light.bloomStart + T.light.bloomUp);
    tl.set({}, {}, T.end);
    tlRef.current = tl;
    updateLighting();
    positionSeal();
    if (process.env.NODE_ENV !== "production") (window as unknown as { __plTl?: gsap.core.Timeline }).__plTl = tl;
    return tl;
  }, [geo, updateLighting, positionSeal]);

  const startIdle = useCallback(() => {
    idleRef.current?.kill();
    if (reduced || !cameraRef.current) return;
    idleRef.current = gsap
      .timeline({ repeat: -1, yoyo: true, defaults: { ease: "sine.inOut" } })
      .to(cameraRef.current, { rotationX: T.idle.swayX, rotationY: -T.idle.swayY, duration: T.idle.period / 2 })
      .to(cameraRef.current, { rotationX: -T.idle.swayX * 0.6, rotationY: T.idle.swayY, duration: T.idle.period / 2 });
  }, [reduced]);

  useLayoutEffect(() => {
    if (!geo || phase === "loading") return;
    if (phase === "closed") {
      buildTimeline();
      startIdle();
    } else if (phase === "opening" && tlRef.current) {
      const t = tlRef.current.time();
      buildTimeline()?.time(t).play();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geo, phase === "loading"]);

  useEffect(
    () => () => {
      tlRef.current?.kill();
      idleRef.current?.kill();
      textTlRef.current?.kill();
      audioRef.current?.pause();
    },
    [],
  );

  // ---------- names are written onto the card ----------
  const writeText = useCallback(() => {
    const hero = heroRef.current;
    if (!hero) return;
    textTlRef.current?.kill();
    const items = Array.from(hero.querySelectorAll<HTMLElement>("[data-seq]")).sort((a, b) => Number(a.dataset.seq) - Number(b.dataset.seq));
    hero.dataset.written = "false";
    if (reduced) {
      gsap.set(items, { autoAlpha: 1, y: 0, "--w": "120%" });
      hero.dataset.written = "true";
      return;
    }
    const tl = gsap.timeline({ onComplete: () => (hero.dataset.written = "true") });
    gsap.set(items, { autoAlpha: 0, y: 8 });
    let t = 0.15;
    for (const el of items) {
      if (el.classList.contains("pl-write")) {
        gsap.set(el, { "--w": "0%", autoAlpha: 1, y: 0 });
        tl.to(el, { "--w": "120%", duration: T.text.writeDur, ease: "power1.inOut" }, t);
        t += T.text.writeDur * 0.72;
      } else {
        tl.to(el, { autoAlpha: 1, y: 0, duration: T.text.dur, ease: "power2.out" }, t);
        t += T.text.stagger + 0.12;
      }
    }
    textTlRef.current = tl;
  }, [reduced]);

  const finishOpening = useCallback(() => {
    setPhase("open");
    requestAnimationFrame(() => writeText());
  }, [writeText]);
  const finishRef = useRef(finishOpening);
  finishRef.current = finishOpening;

  // ---------- interactions ----------
  const open = useCallback(() => {
    if (phaseRef.current === "opening") {
      tlRef.current?.timeScale(3.5);
      return;
    }
    if (phaseRef.current !== "closed") return;
    idleRef.current?.kill();
    onOpenStart?.();
    setPhase("opening");
    if (reduced) {
      if (sceneRef.current) gsap.to(sceneRef.current, { autoAlpha: 0, duration: 0.6, onComplete: () => finishOpening() });
      return;
    }
    if (cameraRef.current) gsap.to(cameraRef.current, { rotationX: 0, rotationY: 0, duration: 0.3, ease: "power2.out" });
    const tl = tlRef.current ?? buildTimeline();
    tl?.timeScale(1).play(0);
  }, [buildTimeline, finishOpening, onOpenStart, reduced]);

  const replay = useCallback(() => {
    textTlRef.current?.kill();
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
    if (sceneRef.current) gsap.set(sceneRef.current, { autoAlpha: 1 });
    setPhase("closed");
    requestAnimationFrame(() => {
      buildTimeline();
      startIdle();
    });
  }, [buildTimeline, startIdle]);

  const toggleMusic = useCallback(() => {
    if (!vm.content.musicUrl) return;
    if (!audioRef.current) {
      audioRef.current = new Audio(vm.content.musicUrl);
      audioRef.current.loop = true;
    }
    const a = audioRef.current;
    if (music) {
      a.pause();
      setMusic(false);
    } else {
      a.play().then(
        () => setMusic(true),
        () => setMusic(false),
      );
    }
  }, [music, vm.content.musicUrl]);

  // ---------- showcase autoplay (landing page phone) ----------
  useEffect(() => {
    if (!showcase) return;
    let t1: number | undefined;
    let raf = 0;
    if (phase === "closed") t1 = window.setTimeout(open, 2200);
    if (phase === "open" && !reduced) {
      const sc = scrollRef.current;
      const startAt = performance.now() + 3200;
      const step = (now: number) => {
        if (!sc) return;
        if (now > startAt) {
          sc.scrollTop += 0.9;
          if (sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 2) {
            t1 = window.setTimeout(replay, 2500);
            return;
          }
        }
        raf = requestAnimationFrame(step);
      };
      if (sc) sc.style.scrollBehavior = "auto";
      raf = requestAnimationFrame(step);
    }
    return () => {
      if (t1) window.clearTimeout(t1);
      cancelAnimationFrame(raf);
    };
  }, [showcase, phase, open, replay, reduced]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      open();
    }
  };

  // ---------- render ----------
  const c = vm.content;
  const couple = !(c.eventType === "party" || c.eventType === "other") || !c.eventTitle;
  const initials = (c.initials || "").trim();
  const date = formatEventDate(c.eventDate);
  const sealBox = M.layers["seal"];
  const topBox = M.layers["flap-top"];
  const mask = (u: string) => ({ WebkitMaskImage: `url(${u})`, maskImage: `url(${u})` }) as CSSProperties;

  const flapEl = (f: FlapName) => {
    const b = M.layers[`flap-${f}`];
    const url = `${base}/flap-${f}.webp`;
    const glints = M.glints.filter((g) => g.layer === f).map((g) => ({ x: (g.x - b.x) / b.w, y: (g.y - b.y) / b.h, s: g.s }));
    return (
      <div
        key={f}
        className="pl-flap"
        data-flap={f}
        ref={(el) => {
          flapRefs.current[f] = el;
        }}
        style={{ left: pct(b.x), top: pct(b.y), width: pct(b.w), height: pct(b.h) }}
      >
        <div className="pl-face" style={{ containerType: "inline-size" } as CSSProperties}>
          <img src={url} alt="" draggable={false} />
          <i className="pl-shade" style={mask(url)} />
          <i className="pl-lit" style={mask(url)} />
          <i className="pl-sheen" style={mask(url)} />
          <Sparkles points={glints} scale={1 / b.w} salt={f.length} />
          {f === "top" ? (
            <i
              ref={anchorRef}
              className="pl-seal-anchor"
              style={{ left: pct((sealBox.x + sealBox.w / 2 - topBox.x) / topBox.w), top: pct((sealBox.y + sealBox.h * 0.12 - topBox.y) / topBox.h) }}
            />
          ) : null}
        </div>
      </div>
    );
  };

  const coverStyle = (w: number, h: number): CSSProperties => ({
    position: "absolute",
    left: "50%",
    top: "50%",
    width: w,
    height: h,
    marginLeft: -w / 2,
    marginTop: -h / 2,
    containerType: "inline-size",
  });

  return (
    <div ref={rootRef} className={`pl-root${reduced ? " pl-reduced" : ""}`} data-variant={vm.variant} data-phase={phase} lang="ar" dir="rtl">
      {badge ? <div className="pl-badge">{badge}</div> : null}

      {/* ---------------- opening scene ---------------- */}
      <div
        ref={sceneRef}
        className="pl-scene"
        data-phase={phase}
        data-done={phase === "open"}
        role="button"
        tabIndex={phase === "closed" ? 0 : -1}
        aria-label="المس لفتح الدعوة"
        onClick={open}
        onKeyDown={onKey}
        style={geo ? { perspective: `${geo.persp}px`, perspectiveOrigin: "50% 50%" } : undefined}
      >
        {geo ? (
          <>
            {/* the lace card lies under the envelope and is revealed in place */}
            <div className="pl-cardlayer">
              <div ref={cardRef} className="pl-cover" style={coverStyle(geo.cardW, geo.cardH)}>
                <img src={`${base}/card.webp`} alt="" draggable={false} />
              </div>
              <div ref={interiorRef} className="pl-interior" />
              <div ref={vignetteRef} className="pl-vignette" />
              <div ref={bloomRef} className="pl-bloom" />
              {FLAPS.map((f) => (
                <div
                  key={f}
                  ref={(el) => {
                    edgeRefs.current[f] = el;
                  }}
                  className={`pl-edge pl-edge-${f}`}
                />
              ))}
            </div>
            <div ref={cameraRef} className="pl-camera" style={{ left: (geo.cw - geo.envW) / 2, top: (geo.ch - geo.envH) / 2, width: geo.envW, height: geo.envH }}>
              <img ref={gapsRef} className="pl-layer-img" src={`${base}/gaps.webp`} alt="" style={{ position: "absolute", inset: 0 }} />
              {FLAPS.map(flapEl)}
              <i className="pl-sweep" aria-hidden="true" />
            </div>
            {/* the seal: always the top layer, above all four flaps */}
            <div ref={sealTopRef} className="pl-seal-top" style={{ width: geo.envW * sealBox.w, height: geo.envH * sealBox.h }}>
              <div className="pl-seal" ref={sealRef}>
                <i className="pl-seal-ring" />
                <i className="pl-seal-ring" />
                <div className="pl-seal-inner">
                  <img src={`${base}/seal.webp`} alt="" draggable={false} />
                  {initials ? (
                    <span className="pl-seal-mono" style={{ fontSize: `${Math.max(12, geo.envW * sealBox.w * 0.2)}px` }}>
                      {initials}
                    </span>
                  ) : null}
                  <i className="pl-seal-gloss" style={mask(`${base}/seal.webp`)} />
                  <i className="pl-seal-shine" style={mask(`${base}/seal.webp`)} />
                </div>
              </div>
            </div>
          </>
        ) : null}

        <div ref={hintRef} className="pl-hint" aria-hidden={phase !== "closed"}>
          <span className="pl-hint-pill">
            <span className="pl-hint-main">المس لفتح الدعوة</span>
            {vm.guest?.name ? <span className="pl-hint-sub">إلى: {vm.guest.name}</span> : null}
          </span>
        </div>

        <div className="pl-loading" data-hidden={phase !== "loading"} aria-hidden={phase !== "loading"}>
          <img src={`${ASSET_ROOT}/${vm.variant}/sm/closed.webp`} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
          <div style={{ position: "relative", marginTop: "60%", textAlign: "center" }}>
            <div className="pl-loading-dot" />
            جارٍ تجهيز دعوتك…
          </div>
        </div>
      </div>

      {phase === "opening" ? (
        <button type="button" className="pl-skip" onClick={() => tlRef.current?.timeScale(4)}>
          تخطي
        </button>
      ) : null}

      {/* ---------------- content after opening ---------------- */}
      <div ref={scrollRef} className="pl-scroll" data-visible={phase === "open"} aria-hidden={phase !== "open"}>
        <section ref={heroRef} className="pl-hero" style={geo ? ({ ["--pl-h" as string]: `${geo.ch}px` } as CSSProperties) : undefined} data-reduced={reduced} aria-label="بطاقة الدعوة">
          {geo ? (
            <div className="pl-cover" style={coverStyle(geo.cardW, geo.cardH)}>
              <img src={`${base}/card.webp`} alt="" draggable={false} />
              <Sparkles points={M.cardGlints} scale={0.8} salt={9} />
            </div>
          ) : null}
          <i className="pl-hero-sweep" aria-hidden="true" />
          {initials ? (
            <div className="pl-hero-mono" data-seq="0">
              {initials}
            </div>
          ) : null}
          <div className="pl-hero-text">
            {c.showBismillah ? (
              <div className="pl-bismillah" data-seq="1">
                بسم الله الرحمن الرحيم
              </div>
            ) : null}
            {c.hostLine ? (
              <div className="pl-line pl-line-sm" data-seq="2">
                {c.hostLine}
              </div>
            ) : null}
            {c.openingLine ? (
              <div className="pl-line" data-seq="3">
                {c.openingLine}
              </div>
            ) : null}
            {c.inviteLine ? (
              <div className="pl-line" data-seq="4">
                {c.inviteLine}
              </div>
            ) : null}
            <div className="pl-names">
              {couple ? (
                <>
                  <span className="pl-name pl-write" data-seq="5">
                    {c.groomName}
                  </span>
                  <span className="pl-and" data-seq="6">
                    و
                  </span>
                  <span className="pl-name pl-write" data-seq="7">
                    {c.brideName}
                  </span>
                </>
              ) : (
                <span className="pl-name pl-write" data-seq="5">
                  {c.eventTitle}
                </span>
              )}
            </div>
            {date ? (
              <div className="pl-date-short" data-seq="8">
                {date.full}
              </div>
            ) : null}
            {vm.guest?.name ? (
              <div className="pl-guest" data-seq="9">
                <div className="pl-guest-label">{c.guestGreeting}:</div>
                <div className="pl-guest-name">{vm.guest.name}</div>
              </div>
            ) : null}
          </div>
          <div className="pl-scroll-cue" aria-hidden="true">
            <span>اسحب للأسفل</span>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M3 6l5 5 5-5" />
            </svg>
          </div>
        </section>
        <Sections vm={vm} assetBase={base} scrollRef={scrollRef} active={phase === "open"} onReplay={replay} />
      </div>

      {/* ---------------- floating controls ---------------- */}
      {phase === "open" && vm.content.musicUrl ? (
        <button type="button" className="pl-fab pl-fab-music" onClick={toggleMusic} aria-label={music ? "إيقاف الموسيقى" : "تشغيل الموسيقى"} aria-pressed={music}>
          {music ? (
            <svg viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="5" width="4" height="14" rx="1" />
              <rect x="14" y="5" width="4" height="14" rx="1" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M9 18V6l10-2v12" />
              <circle cx="7" cy="18" r="2.2" />
              <circle cx="17" cy="16" r="2.2" />
            </svg>
          )}
        </button>
      ) : null}
      {phase === "open" ? (
        <button type="button" className={`pl-fab ${vm.content.musicUrl ? "pl-fab-replay" : "pl-fab-music"}`} onClick={replay} aria-label="إعادة تشغيل العرض">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M4 12a8 8 0 1 0 2.4-5.7" />
            <path d="M4 4v4h4" />
          </svg>
        </button>
      ) : null}
    </div>
  );
}

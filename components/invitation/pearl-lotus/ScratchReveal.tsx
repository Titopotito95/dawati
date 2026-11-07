"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Box = { left: number; top: number; width: number; height: number };

/**
 * Scratch-to-reveal photo inside a page's oval frame (Pearl Lotus, page 4).
 * The top layer is the page's own pearl surface drawn on a <canvas>; scratching erases it
 * (destination-out) to show `photo` underneath. After about half is scratched the rest clears by
 * itself. No wording: a gently moving hand shows what to do until the first touch.
 * `photo` comes from the invitation data, so each customer's own picture is used.
 */
export default function ScratchReveal({
  art,
  frame,
  box,
  photo,
  interactive,
  autoDemo,
  reduced,
}: {
  art: string; // page artwork the top layer is cut from
  frame: string; // the page's frame + flowers with the reveal area transparent (sits above the photo)
  box: Box; // reveal area, as fractions of the artwork
  photo: string;
  interactive: boolean; // real guests / previews; false in the website's phone mock-up
  autoDemo: boolean; // mock-up: scratches itself once it scrolls into view
  reduced: boolean;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handRef = useRef<HTMLDivElement>(null);
  const artRef = useRef<HTMLImageElement | null>(null);
  const touched = useRef(false); // any scratching done (do not repaint over it on resize)
  const [started, setStarted] = useState(false);
  const [cleared, setCleared] = useState(false);
  const [demoing, setDemoing] = useState(false);

  const paint = useCallback(() => {
    const cv = canvasRef.current;
    const wrap = wrapRef.current;
    const img = artRef.current;
    if (!cv || !wrap || !img || !img.naturalWidth) return;
    const r = wrap.getBoundingClientRect();
    if (r.width < 2) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(r.width * dpr);
    cv.height = Math.round(r.height * dpr);
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.globalCompositeOperation = "source-over";
    const W = img.naturalWidth;
    const H = img.naturalHeight;
    ctx.drawImage(img, box.left * W, box.top * H, box.width * W, box.height * H, 0, 0, cv.width, cv.height);
    // a faint pearl-foil gloss so it reads as a surface on top
    const g = ctx.createLinearGradient(0, 0, cv.width, cv.height);
    g.addColorStop(0, "rgba(255,255,255,0.18)");
    g.addColorStop(0.5, "rgba(255,255,255,0)");
    g.addColorStop(1, "rgba(255,238,244,0.16)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, cv.width, cv.height);
  }, [box]);

  // load the artwork, paint, keep the layer sized to its box until scratching starts
  useEffect(() => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      artRef.current = img;
      if (!touched.current) paint();
    };
    img.src = art;
    const wrap = wrapRef.current;
    if (!wrap || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      if (!touched.current) paint();
    });
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [art, paint]);

  const erase = useCallback((x0: number, y0: number, x1: number, y1: number) => {
    const cv = canvasRef.current;
    const ctx = cv?.getContext("2d");
    if (!cv || !ctx) return;
    ctx.globalCompositeOperation = "destination-out";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = cv.width * 0.17;
    ctx.shadowColor = "#000";
    ctx.shadowBlur = cv.width * 0.04; // soft edges
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1 + 0.01, y1);
    ctx.stroke();
    touched.current = true;
  }, []);

  /** share of the oval already scratched (sampled grid) */
  const progress = useCallback(() => {
    const cv = canvasRef.current;
    const ctx = cv?.getContext("2d");
    if (!cv || !ctx || !cv.width) return 0;
    const data = ctx.getImageData(0, 0, cv.width, cv.height).data;
    let all = 0;
    let gone = 0;
    for (let j = 0; j < 46; j++) {
      for (let i = 0; i < 36; i++) {
        const u = (i + 0.5) / 36;
        const v = (j + 0.5) / 46;
        if ((u - 0.5) ** 2 / 0.25 + (v - 0.5) ** 2 / 0.25 > 1) continue; // outside the oval
        all++;
        const x = Math.floor(u * cv.width);
        const y = Math.floor(v * cv.height);
        if (data[(y * cv.width + x) * 4 + 3] < 40) gone++;
      }
    }
    return all ? gone / all : 0;
  }, []);

  // ---------- finger / mouse ----------
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv || !interactive) return;
    let down = false;
    let last: [number, number] | null = null;
    let lastCheck = 0;
    const pt = (e: PointerEvent): [number, number] => {
      const r = cv.getBoundingClientRect();
      return [((e.clientX - r.left) * cv.width) / r.width, ((e.clientY - r.top) * cv.height) / r.height];
    };
    const check = (force = false) => {
      const now = performance.now();
      if (!force && now - lastCheck < 180) return;
      lastCheck = now;
      if (progress() > 0.5) setCleared(true);
    };
    const onDown = (e: PointerEvent) => {
      down = true;
      last = pt(e);
      cv.setPointerCapture?.(e.pointerId);
      setStarted(true);
      erase(last[0], last[1], last[0], last[1]);
    };
    const onMove = (e: PointerEvent) => {
      if (!down || !last) return;
      const evs = (e.getCoalescedEvents?.() ?? []).length ? e.getCoalescedEvents() : [e];
      for (const ev of evs) {
        const p = pt(ev);
        erase(last[0], last[1], p[0], p[1]);
        last = p;
      }
      check();
    };
    const onUp = () => {
      if (!down) return;
      down = false;
      last = null;
      check(true);
    };
    cv.addEventListener("pointerdown", onDown);
    cv.addEventListener("pointermove", onMove);
    cv.addEventListener("pointerup", onUp);
    cv.addEventListener("pointercancel", onUp);
    return () => {
      cv.removeEventListener("pointerdown", onDown);
      cv.removeEventListener("pointermove", onMove);
      cv.removeEventListener("pointerup", onUp);
      cv.removeEventListener("pointercancel", onUp);
    };
  }, [interactive, erase, progress]);

  // ---------- website mock-up: the hand scratches it once by itself ----------
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!autoDemo || reduced || !wrap || typeof IntersectionObserver === "undefined") return;
    let raf = 0;
    let ran = false;
    const path: [number, number][] = [
      [0.22, 0.3], [0.78, 0.36], [0.24, 0.48], [0.8, 0.56], [0.26, 0.68], [0.74, 0.76],
    ];
    const run = () => {
      const cv = canvasRef.current;
      const hand = handRef.current;
      if (!cv || !hand) return;
      setDemoing(true);
      setStarted(true);
      const dur = 1900;
      const t0 = performance.now();
      let prev: [number, number] | null = null;
      const step = (now: number) => {
        const k = Math.min(1, (now - t0) / dur) * (path.length - 1);
        const i = Math.min(path.length - 2, Math.floor(k));
        const f = k - i;
        const u = path[i][0] + (path[i + 1][0] - path[i][0]) * f;
        const v = path[i][1] + (path[i + 1][1] - path[i][1]) * f;
        hand.style.left = `${u * 100}%`;
        hand.style.top = `${v * 100}%`;
        const p: [number, number] = [u * cv.width, v * cv.height];
        if (prev) erase(prev[0], prev[1], p[0], p[1]);
        prev = p;
        if (k < path.length - 1) raf = requestAnimationFrame(step);
        else {
          setDemoing(false);
          setCleared(true);
        }
      };
      raf = requestAnimationFrame(step);
    };
    const io = new IntersectionObserver(
      (en) => {
        if (!ran && en[0]?.isIntersecting) {
          ran = true;
          window.setTimeout(run, 500);
        }
      },
      { threshold: 0.7 },
    );
    io.observe(wrap);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [autoDemo, reduced, erase]);

  const reset = () => {
    touched.current = false;
    setCleared(false);
    setStarted(false);
    paint();
  };

  const pos = {
    left: `${box.left * 100}%`,
    top: `${box.top * 100}%`,
    width: `${box.width * 100}%`,
    height: `${box.height * 100}%`,
  };
  return (
    <>
      <div ref={wrapRef} className="lt-reveal" style={pos} data-cleared={cleared || undefined} data-started={started || undefined}>
        <img className="lt-reveal-photo" src={photo} alt="" draggable={false} decoding="async" />
        <canvas ref={canvasRef} className="lt-reveal-canvas" data-interactive={interactive || undefined} aria-hidden="true" />
        <span className="lt-reveal-sheen" aria-hidden="true" />
      </div>
      <img className="lt-frame" src={frame} alt="" draggable={false} decoding="async" />
      <div className="lt-reveal-top" style={pos} aria-hidden="true">
        <div
          ref={handRef}
          className={`lt-hand${demoing ? " lt-hand-js" : ""}`}
          data-hidden={(started && !demoing) || (autoDemo && !demoing) || undefined}
          data-static={reduced || undefined}
        >
          <svg viewBox="0 0 64 64" width="100%" height="100%" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
            <circle className="lt-hand-tap" cx="30.5" cy="8" r="7" fill="currentColor" stroke="none" />
            <path d="M27 31V10.5a3.5 3.5 0 0 1 7 0V28M34 27.5v-2a3.5 3.5 0 0 1 7 0V30M41 28.5a3.5 3.5 0 0 1 7 0V31M48 31a3.5 3.5 0 0 1 7 0v11c0 9-6 16-15 16h-3.5c-5 0-8.5-2-11.5-6L14 39.5a3.6 3.6 0 0 1 5.3-4.8L27 46.5V31" />
          </svg>
        </div>
        {cleared && interactive ? (
          <button type="button" className="lt-reveal-reset" aria-label="إعادة الكشط" onClick={reset}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 12a9 9 0 1 0 3-6.7" />
              <path d="M3 4v5h5" />
            </svg>
          </button>
        ) : null}
      </div>
    </>
  );
}

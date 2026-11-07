"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { uploadPhotoAction, deletePhotoAction, uploadMusicAction, removeMusicAction } from "@/app/dashboard/actions";
import type { InvitationPhoto } from "@/lib/invitation/types";

/** 4:5 cropper: drag to position, slider to zoom, exported client-side as JPEG then re-encoded server-side. */
function Cropper({ file, onDone, onCancel }: { file: File; onDone: (b: Blob) => void; onCancel: () => void }) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [off, setOff] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const W = 280;
  const H = 350;

  useEffect(() => {
    const url = URL.createObjectURL(file);
    const i = new Image();
    i.onload = () => setImg(i);
    i.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  if (!img) return <p className="hint">جارٍ تحميل الصورة…</p>;
  const base = Math.max(W / img.naturalWidth, H / img.naturalHeight);
  const s = base * zoom;
  const dw = img.naturalWidth * s;
  const dh = img.naturalHeight * s;
  const clamp = (o: { x: number; y: number }) => ({
    x: Math.min(0, Math.max(W - dw, o.x)),
    y: Math.min(0, Math.max(H - dh, o.y)),
  });
  const pos = clamp(off.x === 0 && off.y === 0 ? { x: (W - dw) / 2, y: (H - dh) / 2 } : off);

  function exportCrop() {
    const out = document.createElement("canvas");
    const scale = Math.min(4, 1400 / W);
    out.width = Math.round(W * scale);
    out.height = Math.round(H * scale);
    const ctx = out.getContext("2d")!;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img!, -pos.x / s, -pos.y / s, W / s, H / s, 0, 0, out.width, out.height);
    out.toBlob((b) => b && onDone(b), "image/jpeg", 0.9);
  }

  return (
    <div className="rounded-2xl border border-rose/20 p-4">
      <div
        className="relative mx-auto touch-none overflow-hidden rounded-t-full rounded-b-xl bg-blush"
        style={{ width: W, height: H, cursor: "grab" }}
        onPointerDown={(e) => {
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          drag.current = { x: e.clientX, y: e.clientY, ox: pos.x, oy: pos.y };
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          setOff(clamp({ x: drag.current.ox + e.clientX - drag.current.x, y: drag.current.oy + e.clientY - drag.current.y }));
        }}
        onPointerUp={() => (drag.current = null)}
      >
        <img src={img.src} alt="" draggable={false} style={{ position: "absolute", left: pos.x, top: pos.y, width: dw, height: dh, maxWidth: "none" }} />
      </div>
      <label className="mx-auto mt-3 block max-w-[280px] text-sm">
        التكبير
        <input type="range" min={1} max={3} step={0.01} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="w-full accent-burgundy" />
      </label>
      <div className="mt-3 flex justify-center gap-2">
        <button type="button" className="btn btn-primary btn-sm" onClick={exportCrop}>قص ورفع الصورة</button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>إلغاء</button>
      </div>
      <p className="hint text-center">اسحب الصورة لضبط موضعها داخل الإطار.</p>
    </div>
  );
}

export function PhotoManager({ photos, maxPhotos, maxMb }: { photos: InvitationPhoto[]; maxPhotos: number; maxMb: number }) {
  const [file, setFile] = useState<File | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function upload(b: Blob) {
    setFile(null);
    start(async () => {
      const fd = new FormData();
      fd.append("file", b, "photo.jpg");
      const r = await uploadPhotoAction(fd);
      setMsg({ ok: r.ok, text: r.message || "" });
    });
  }

  return (
    <section className="card p-5">
      <h2 className="font-semibold">صور العروسين</h2>
      <p className="hint">حتى {maxPhotos} صور، بحجم أقصاه {maxMb} ميغابايت لكل صورة. تُضغط الصور وتُزال بيانات الموقع منها تلقائياً. فعّل صفحة «صور العروسين» من الأعلى لتظهر.</p>
      <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-6">
        {photos.map((p) => (
          <div key={p.id} className="relative">
            <img src={p.url} alt="" className="aspect-[4/5] w-full rounded-t-full rounded-b-lg object-cover" />
            <button
              type="button"
              className="absolute -left-1 -top-1 grid h-7 w-7 place-items-center rounded-full bg-white text-danger shadow"
              aria-label="حذف الصورة"
              onClick={() => {
                if (!window.confirm("حذف هذه الصورة؟")) return;
                start(async () => {
                  const r = await deletePhotoAction(p.id);
                  setMsg({ ok: r.ok, text: r.message || "" });
                });
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>
      {file ? (
        <div className="mt-4">
          <Cropper file={file} onDone={upload} onCancel={() => setFile(null)} />
        </div>
      ) : photos.length < maxPhotos ? (
        <div className="mt-4">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              if (f.size > maxMb * 1024 * 1024) {
                setMsg({ ok: false, text: `حجم الصورة أكبر من ${maxMb} ميغابايت` });
                return;
              }
              setFile(f);
            }}
          />
          <button type="button" className="btn btn-outline btn-sm" disabled={pending} onClick={() => inputRef.current?.click()}>
            {pending ? "جارٍ الرفع…" : "إضافة صورة"}
          </button>
        </div>
      ) : null}
      {msg ? <p className={`mt-3 text-sm ${msg.ok ? "text-success" : "text-danger"}`} role="status">{msg.text}</p> : null}
    </section>
  );
}

export function MusicManager({ musicUrl }: { musicUrl: string }) {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const ref = useRef<HTMLInputElement>(null);
  return (
    <section className="card p-5">
      <h2 className="font-semibold">موسيقى (اختياري)</h2>
      <p className="hint">لا تعمل الموسيقى تلقائياً أبداً؛ يظهر للضيف زر ليشغّلها بنفسه. MP3 أو M4A حتى 6 ميغابايت. تأكد أن لديك حق استخدام المقطع.</p>
      {musicUrl ? (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <audio controls preload="none" src={musicUrl} className="max-w-full" />
          <button type="button" className="btn btn-ghost btn-sm text-danger" disabled={pending} onClick={() => start(async () => { const r = await removeMusicAction(); setMsg({ ok: r.ok, text: r.message || "" }); })}>
            إزالة الموسيقى
          </button>
        </div>
      ) : null}
      <input
        ref={ref}
        type="file"
        accept="audio/mpeg,audio/mp4,audio/x-m4a,.mp3,.m4a"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          start(async () => {
            const fd = new FormData();
            fd.append("file", f);
            const r = await uploadMusicAction(fd);
            setMsg({ ok: r.ok, text: r.message || "" });
          });
        }}
      />
      <button type="button" className="btn btn-outline btn-sm mt-3" disabled={pending} onClick={() => ref.current?.click()}>
        {pending ? "جارٍ الرفع…" : musicUrl ? "استبدال الموسيقى" : "إضافة موسيقى"}
      </button>
      {msg ? <p className={`mt-3 text-sm ${msg.ok ? "text-success" : "text-danger"}`} role="status">{msg.text}</p> : null}
    </section>
  );
}

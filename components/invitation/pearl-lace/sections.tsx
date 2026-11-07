"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { InvitationViewModel, RsvpStatus } from "@/lib/invitation/types";
import { formatEventDate, formatEventTime, toArabicDigits, parseLocalDate } from "@/lib/invitation/format";
import { BeadedScallopBand, Divider, RibbonBow, SwanPair } from "./ornaments";

/** Libya observes UTC+2 all year. Kept as a constant so it can become a per-invitation setting. */
const EVENT_TZ_OFFSET_MIN = 120;

export function eventStartUtc(date: string, time: string): Date | null {
  const d = parseLocalDate(date);
  if (!d) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(time || "") ?? ["", "20", "00"];
  const ms = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), Number(m[1]), Number(m[2])) - EVENT_TZ_OFFSET_MIN * 60000;
  return new Date(ms);
}

function useReveal(rootRef: RefObject<HTMLElement | null>, enabled: boolean) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root || !enabled) return;
    const els = Array.from(root.querySelectorAll<HTMLElement>("[data-reveal]"));
    if (typeof IntersectionObserver === "undefined") {
      els.forEach((e) => e.classList.add("pl-in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const en of entries) {
          if (en.isIntersecting) {
            en.target.classList.add("pl-in");
            io.unobserve(en.target);
          }
        }
      },
      { root, threshold: 0.18 },
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [rootRef, enabled]);
}

function Countdown({ target }: { target: Date }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  if (now === null) return null;
  const diff = Math.max(0, target.getTime() - now);
  if (diff === 0) return <p className="pl-text">بدأ الحفل — أهلاً وسهلاً بكم</p>;
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  const secs = Math.floor((diff % 60000) / 1000);
  const cells: [number, string][] = [
    [days, "يوم"],
    [hours, "ساعة"],
    [mins, "دقيقة"],
    [secs, "ثانية"],
  ];
  return (
    <div className="pl-countdown" role="timer" aria-live="off">
      {cells.map(([v, l]) => (
        <div className="pl-count-cell" key={l}>
          <div className="pl-count-num">{toArabicDigits(String(v).padStart(2, "0"))}</div>
          <div className="pl-count-label">{l}</div>
        </div>
      ))}
    </div>
  );
}

function downloadIcs(vm: InvitationViewModel, start: Date) {
  const c = vm.content;
  const end = new Date(start.getTime() + 4 * 3600000);
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const esc = (s: string) => s.replace(/[\\,;]/g, (m) => "\\" + m).replace(/\n/g, "\\n");
  const title = c.eventType === "party" || c.eventType === "other" ? c.eventTitle || "مناسبة" : `${c.inviteLine.replace("نتشرف بدعوتكم لحضور ", "")} ${c.groomName} و${c.brideName}`;
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Dawati//Invitation//AR",
    "BEGIN:VEVENT",
    `UID:${fmt(start)}-${Math.random().toString(36).slice(2)}@dawati`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${esc(title)}`,
    `LOCATION:${esc([c.venueName, c.address].filter(Boolean).join(" - "))}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "invitation.ics";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function safeHttpsUrl(u: string): string | null {
  try {
    const url = new URL(u);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function LaceBand({ src, flip }: { src: string; flip?: boolean }) {
  return <img className={`pl-band${flip ? " pl-band-flip" : ""}`} src={src} alt="" aria-hidden="true" decoding="async" loading="lazy" />;
}

function Rsvp({ vm }: { vm: InvitationViewModel }) {
  const g = vm.guest;
  const maxParty = Math.max(1, g?.maxPartySize ?? vm.settings.defaultMaxPartySize ?? 1);
  const [status, setStatus] = useState<RsvpStatus | null>(g?.rsvp?.status ?? null);
  const [party, setParty] = useState<number>(g?.rsvp?.partySize ?? 1);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">(g?.rsvp ? "saved" : "idle");
  const [err, setErr] = useState("");
  const isGuest = vm.mode === "guest" && !!vm.guestToken;

  async function submit(next: RsvpStatus) {
    setStatus(next);
    setErr("");
    if (!isGuest) {
      setState("saved");
      return;
    }
    setState("saving");
    try {
      const res = await fetch("/api/guest/rsvp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: vm.guestToken, status: next, partySize: next === "accepted" ? party : 0 }),
        credentials: "omit",
        referrerPolicy: "no-referrer",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "تعذر حفظ ردكم، حاولوا مرة أخرى");
      setState("saved");
    } catch (e) {
      setState("error");
      setErr(e instanceof Error ? e.message : "تعذر حفظ ردكم، حاولوا مرة أخرى");
    }
  }

  if (!vm.settings.rsvpEnabled) return null;
  return (
    <div className="pl-rsvp-box">
      {g?.name ? (
        <p className="pl-text pl-rv" style={{ ["--i" as string]: 1 }}>
          {g.name}
        </p>
      ) : null}
      {vm.settings.allowPartySize && maxParty > 1 ? (
        <div className="pl-rv" style={{ ["--i" as string]: 2 }}>
          <div className="pl-note">عدد الحاضرين (الحد الأقصى {toArabicDigits(maxParty)})</div>
          <div className="pl-stepper" aria-label="عدد الحاضرين">
            <button type="button" aria-label="زيادة" onClick={() => setParty((p) => Math.min(maxParty, p + 1))}>
              +
            </button>
            <span aria-live="polite">{toArabicDigits(party)}</span>
            <button type="button" aria-label="إنقاص" onClick={() => setParty((p) => Math.max(1, p - 1))}>
              −
            </button>
          </div>
        </div>
      ) : null}
      <div className="pl-rv" style={{ ["--i" as string]: 3 }}>
        <button
          type="button"
          className="pl-btn"
          aria-pressed={status === "accepted"}
          disabled={state === "saving"}
          onClick={() => submit("accepted")}
        >
          سأحضر بإذن الله
        </button>
        <button
          type="button"
          className="pl-btn"
          aria-pressed={status === "declined"}
          disabled={state === "saving"}
          onClick={() => submit("declined")}
        >
          أعتذر عن الحضور
        </button>
      </div>
      <div aria-live="polite">
        {state === "saving" ? <p className="pl-note">جارٍ حفظ ردكم…</p> : null}
        {state === "saved" && status ? (
          <p className="pl-note">
            {status === "accepted" ? "شكراً لكم! تم تأكيد حضوركم، ننتظركم بكل شوق." : "شكراً لإبلاغنا، نتمنى لقاءكم في مناسبات قادمة."}
            {!isGuest ? <><br />(معاينة فقط — لا يتم حفظ الرد)</> : null}
          </p>
        ) : null}
        {state === "error" ? <p className="pl-note pl-error">{err}</p> : null}
      </div>
    </div>
  );
}

export function Sections({
  vm,
  assetBase,
  scrollRef,
  active,
  onReplay,
}: {
  vm: InvitationViewModel;
  assetBase: string;
  scrollRef: RefObject<HTMLDivElement | null>;
  active: boolean;
  onReplay: () => void;
}) {
  const c = vm.content;
  const p = vm.pages;
  const date = useMemo(() => formatEventDate(c.eventDate), [c.eventDate]);
  const time = formatEventTime(c.eventTime);
  const start = useMemo(() => eventStartUtc(c.eventDate, c.eventTime), [c.eventDate, c.eventTime]);
  const maps = c.mapsUrl ? safeHttpsUrl(c.mapsUrl) : null;
  const band = `${assetBase}/lace-band.webp`;
  const rootRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    rootRef.current = scrollRef.current;
  });
  useReveal(scrollRef, active);
  const couple = !(c.eventType === "party" || c.eventType === "other") || !c.eventTitle;

  return (
    <>
      {p.welcome ? (
        <section className="pl-section pl-section-paper" data-reveal>
          <SwanPair className="pl-ornament pl-rv" />
          {c.hostLine ? (
            <p className="pl-title pl-rv" style={{ ["--i" as string]: 1 }}>
              {c.hostLine}
            </p>
          ) : null}
          <p className="pl-text pl-rv" style={{ ["--i" as string]: 2 }}>
            {c.welcomeMessage}
          </p>
          <Divider className="pl-divider pl-rv" />
        </section>
      ) : null}

      {p.details ? (
        <>
          <LaceBand src={band} />
          <section className="pl-section pl-section-burgundy" data-reveal>
            <RibbonBow className="pl-bow pl-rv" />
            <h2 className="pl-title pl-rv" style={{ ["--i" as string]: 1 }}>
              موعد الحفل
            </h2>
            {date ? (
              <div className="pl-date-big pl-rv" style={{ ["--i" as string]: 2 }}>
                <div className="pl-dside">{date.day}</div>
                <div className="pl-dnum">{date.date}</div>
                <div className="pl-dside">
                  {date.month}
                  <br />
                  {date.year}
                </div>
              </div>
            ) : (
              <p className="pl-text pl-rv">سيتم تحديد الموعد قريباً</p>
            )}
            {time ? (
              <p className="pl-text pl-rv" style={{ ["--i" as string]: 3 }}>
                الساعة {time}
                {c.timeNote ? ` — ${c.timeNote}` : ""}
              </p>
            ) : null}
            {start ? (
              <div className="pl-rv" style={{ ["--i" as string]: 4 }}>
                <Countdown target={start} />
                <button type="button" className="pl-btn" onClick={() => downloadIcs(vm, start)}>
                  أضف إلى التقويم
                </button>
              </div>
            ) : null}
            <RibbonBow className="pl-bow pl-rv" />
          </section>
          <LaceBand src={band} flip />
        </>
      ) : null}

      {p.venue && (c.venueName || c.address) ? (
        <section className="pl-section pl-section-paper" data-reveal>
          <h2 className="pl-title pl-rv">موقع الحفل</h2>
          <div className="pl-arch pl-rv" style={{ ["--i" as string]: 1 }}>
            <div>
              {c.venueName ? <p className="pl-script">{c.venueName}</p> : null}
              {c.address ? <p className="pl-text">{c.address}</p> : null}
              {maps ? (
                <a className="pl-btn pl-btn-solid" href={maps} target="_blank" rel="noopener noreferrer">
                  فتح الموقع على الخريطة
                </a>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      {p.photos && c.photos.length > 0 ? (
        <section className="pl-section pl-section-paper" data-reveal>
          <h2 className="pl-title pl-rv">{couple ? "صور العروسين" : "صور المناسبة"}</h2>
          <div className="pl-photos">
            {c.photos.slice(0, 6).map((ph, i) => (
              <img key={ph.id} className="pl-photo pl-rv" style={{ ["--i" as string]: i }} src={ph.url} alt="" loading="lazy" decoding="async" />
            ))}
          </div>
        </section>
      ) : null}

      {p.message && c.customMessage ? (
        <section className="pl-section pl-section-paper" data-reveal>
          <Divider className="pl-divider pl-rv" />
          <p className="pl-text pl-rv" style={{ ["--i" as string]: 1 }}>
            {c.customMessage}
          </p>
          <Divider className="pl-divider pl-rv" />
        </section>
      ) : null}

      {p.rsvp && vm.settings.rsvpEnabled ? (
        <>
          <LaceBand src={band} />
          <section className="pl-section pl-section-burgundy" data-reveal>
            <RibbonBow className="pl-bow pl-rv" />
            <h2 className="pl-title pl-rv" style={{ ["--i" as string]: 1 }}>
              تأكيد الحضور
            </h2>
            <p className="pl-note pl-rv" style={{ ["--i" as string]: 1 }}>
              يسعدنا تأكيد حضوركم
            </p>
            <Rsvp vm={vm} />
            <BeadedScallopBand className="pl-bow pl-rv" />
          </section>
          <LaceBand src={band} flip />
        </>
      ) : null}

      {p.thanks ? (
        <section className="pl-section pl-section-paper" data-reveal>
          <Divider className="pl-divider pl-rv" />
          <p className="pl-text pl-rv" style={{ ["--i" as string]: 1 }}>
            {c.closingMessage}
          </p>
          <p className="pl-script pl-rv" style={{ ["--i" as string]: 2 }}>
            {couple ? `${c.groomName} و ${c.brideName}` : c.eventTitle}
          </p>
          {date ? (
            <p className="pl-note pl-rv" style={{ ["--i" as string]: 3 }}>
              {date.full}
            </p>
          ) : null}
          <button type="button" className="pl-btn pl-rv" style={{ ["--i" as string]: 4 }} onClick={onReplay}>
            إعادة تشغيل العرض
          </button>
        </section>
      ) : null}
      <div className="pl-footer">صُممت هذه الدعوة بكل حب</div>
    </>
  );
}

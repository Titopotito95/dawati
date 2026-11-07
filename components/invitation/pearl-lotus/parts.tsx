"use client";

import { useEffect, useState, type RefObject } from "react";
import type { InvitationViewModel } from "@/lib/invitation/types";
import { parseLocalDate, toArabicDigits } from "@/lib/invitation/format";

/** Shared pieces of the Pearl Lotus theme (same behaviour as the other themes, own styling). */

/** Libya observes UTC+2 all year. */
const EVENT_TZ_OFFSET_MIN = 120;

export function eventStartUtc(date: string, time: string): Date | null {
  const d = parseLocalDate(date);
  if (!d) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(time || "") ?? ["", "20", "00"];
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), Number(m[1]), Number(m[2])) - EVENT_TZ_OFFSET_MIN * 60000);
}

export function safeHttpsUrl(u: string): string | null {
  try {
    const url = new URL(u);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

/** Adds .lt-in to [data-reveal] blocks as they scroll into view (their .lt-rv children fade up). */
export function useReveal(rootRef: RefObject<HTMLElement | null>, enabled: boolean) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root || !enabled) return;
    const els = Array.from(root.querySelectorAll<HTMLElement>("[data-reveal]"));
    if (typeof IntersectionObserver === "undefined") {
      els.forEach((e) => e.classList.add("lt-in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const en of entries) {
          if (en.isIntersecting) {
            en.target.classList.add("lt-in");
            io.unobserve(en.target);
          }
        }
      },
      { root, threshold: 0.15 },
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [rootRef, enabled]);
}

export function Countdown({ target }: { target: Date }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  if (now === null) return null;
  const diff = Math.max(0, target.getTime() - now);
  if (diff === 0) return <p className="lt-text">بدأ الحفل — أهلاً وسهلاً بكم</p>;
  const cells: [number, string][] = [
    [Math.floor(diff / 86400000), "يوم"],
    [Math.floor((diff % 86400000) / 3600000), "ساعة"],
    [Math.floor((diff % 3600000) / 60000), "دقيقة"],
    [Math.floor((diff % 60000) / 1000), "ثانية"],
  ];
  return (
    <div className="lt-countdown" role="timer" aria-live="off">
      {cells.map(([v, l]) => (
        <div className="lt-count-cell" key={l}>
          <div className="lt-count-num">{toArabicDigits(String(v).padStart(2, "0"))}</div>
          <div className="lt-count-label">{l}</div>
        </div>
      ))}
    </div>
  );
}

export function downloadIcs(vm: InvitationViewModel, start: Date) {
  const c = vm.content;
  const end = new Date(start.getTime() + 4 * 3600000);
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const esc = (s: string) => s.replace(/[\\,;]/g, (m) => "\\" + m).replace(/\n/g, "\\n");
  const title =
    c.eventType === "party" || c.eventType === "other"
      ? c.eventTitle || "مناسبة"
      : `${c.inviteLine.replace("نتشرف بدعوتكم لحضور ", "")} ${c.groomName} و${c.brideName}`;
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
  const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "invitation.ics";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

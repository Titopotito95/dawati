/** Arabic date/time formatting with Arabic-Indic digits where appropriate. */
const AR_DAYS = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const AR_MONTHS = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

export function toArabicDigits(s: string | number): string {
  return String(s).replace(/[0-9]/g, (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)]);
}

export function parseLocalDate(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatEventDate(iso: string): { day: string; date: string; month: string; year: string; full: string } | null {
  const d = parseLocalDate(iso);
  if (!d) return null;
  const day = AR_DAYS[d.getUTCDay()];
  const date = toArabicDigits(d.getUTCDate());
  const month = AR_MONTHS[d.getUTCMonth()];
  const year = toArabicDigits(d.getUTCFullYear());
  return { day, date, month, year, full: `${day} ${date} ${month} ${year}` };
}

export function formatEventTime(hhmm: string): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm || "");
  if (!m) return "";
  let h = Number(m[1]);
  const min = m[2];
  const period = h >= 12 ? "مساءً" : "صباحاً";
  h = h % 12 === 0 ? 12 : h % 12;
  return `${toArabicDigits(h)}:${toArabicDigits(min)} ${period}`;
}

export function formatDateTimeAr(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const dt = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(dt.getTime())) return "—";
  return new Intl.DateTimeFormat("ar-LY", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Tripoli",
  }).format(dt);
}

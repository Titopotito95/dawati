/**
 * Money is always handled as integer MINOR units. Never use floating point for amounts.
 * LYD has 3 decimal places (1 dinar = 1000 dirham), so 350 LYD = 350000.
 */
export const CURRENCY_EXPONENT: Record<string, number> = { LYD: 3, TND: 3, KWD: 3, BHD: 3, OMR: 3, USD: 2, EUR: 2, EGP: 2, SAR: 2, AED: 2 };
export const CURRENCY_LABEL_AR: Record<string, string> = { LYD: "د.ل", USD: "دولار", EUR: "يورو", TND: "د.ت", EGP: "ج.م", SAR: "ر.س", AED: "د.إ" };

export function exponent(currency: string): number {
  return CURRENCY_EXPONENT[currency] ?? 2;
}

/** "350" → 350000 for LYD. Accepts Arabic-Indic digits and both decimal separators. Returns null if invalid. */
export function parseMajorToMinor(input: string, currency: string): number | null {
  const s = (input || "")
    .trim()
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[٫,]/g, ".");
  const e = exponent(currency);
  const m = new RegExp(`^(\\d{1,9})(?:\\.(\\d{1,${e}}))?$`).exec(s);
  if (!m) return null;
  const whole = BigInt(m[1]);
  const frac = BigInt((m[2] || "").padEnd(e, "0") || "0");
  const v = whole * BigInt(10 ** e) + frac;
  return v > BigInt(Number.MAX_SAFE_INTEGER) ? null : Number(v);
}

export function formatMoney(minor: number, currency: string): string {
  const e = exponent(currency);
  const neg = minor < 0;
  const abs = Math.abs(Math.trunc(minor));
  const whole = Math.floor(abs / 10 ** e);
  let frac = String(abs % 10 ** e).padStart(e, "0").replace(/0+$/, "");
  const wholeStr = whole.toLocaleString("en-US");
  const label = CURRENCY_LABEL_AR[currency] ?? currency;
  frac = frac ? "." + frac : "";
  return `${neg ? "−" : ""}${wholeStr}${frac} ${label}`;
}

/**
 * Commission = basis × rate, rate in basis points (1500 = 15%), rounded half-up to the minor unit.
 * Exact integer arithmetic (BigInt). Example: 350000 × 1500 / 10000 = 52500 (52.5 LYD).
 */
export function commissionFor(basisMinor: number, rateBps: number): number {
  if (!Number.isInteger(basisMinor) || !Number.isInteger(rateBps)) throw new Error("integer inputs required");
  if (rateBps < 0 || rateBps > 10000) throw new Error("rate out of range");
  const sign = basisMinor < 0 ? -1n : 1n;
  const b = BigInt(Math.abs(basisMinor));
  const v = (b * BigInt(rateBps) + 5000n) / 10000n;
  return Number(sign * v);
}

export function formatRate(bps: number): string {
  const v = bps / 100;
  return `${Number.isInteger(v) ? v : v.toFixed(2)}٪`;
}

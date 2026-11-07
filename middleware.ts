import { NextResponse, type NextRequest } from "next/server";

/**
 * 1) Referral capture: any page opened with ?ref=CODE is sent through /api/ref, which validates
 *    the code server-side, records the visit, sets a first-party visitor cookie, and redirects
 *    back to the clean URL (so the code is not kept in the address bar or shared further).
 * 2) Guest links /i/<token>: strict no-referrer + noindex (also set in next.config headers).
 */
export function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const ref = url.searchParams.get("ref");
  if (ref && req.method === "GET" && !url.pathname.startsWith("/api/") && !url.pathname.startsWith("/i/")) {
    const clean = url.clone();
    clean.searchParams.delete("ref");
    const target = url.clone();
    target.pathname = "/api/ref";
    target.search = "";
    target.searchParams.set("code", ref.slice(0, 40));
    target.searchParams.set("next", clean.pathname + clean.search);
    return NextResponse.redirect(target, 307);
  }
  const res = NextResponse.next();
  if (url.pathname.startsWith("/i/")) {
    res.headers.set("Referrer-Policy", "no-referrer");
    res.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  }
  return res;
}

export const config = {
  matcher: ["/((?!_next/|assets/|favicon|.*\\.(?:webp|png|jpg|svg|ico|woff2?|css|js)$).*)"],
};

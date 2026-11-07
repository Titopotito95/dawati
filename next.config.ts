import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

// Content-Security-Policy: no third-party origins at all (fonts and assets are self-hosted),
// so guest bearer URLs can never leak through third-party requests.
const csp = [
  "default-src 'self'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}`,
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  distDir: process.env.NEXT_DIST_DIR || ".next",
  reactStrictMode: true,
  serverExternalPackages: ["@electric-sql/pglite", "sharp", "pg"],
  experimental: { serverActions: { bodySizeLimit: "2mb" } },
  async headers() {
    const base = [
      { key: "Content-Security-Policy", value: csp },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
      { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
      ...(isProd ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }] : []),
    ];
    const privateArea = [
      { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
      { key: "Cache-Control", value: "private, no-store" },
    ];
    return [
      { source: "/:path*", headers: base },
      // Guest bearer links: never send the URL as a referrer, never index, never cache publicly.
      { source: "/i/:path*", headers: [...privateArea, { key: "Referrer-Policy", value: "no-referrer" }] },
      { source: "/dashboard/:path*", headers: privateArea },
      { source: "/dashboard", headers: privateArea },
      { source: "/affiliate/:path*", headers: privateArea },
      { source: "/affiliate", headers: privateArea },
      { source: "/owner/:path*", headers: privateArea },
      { source: "/owner", headers: privateArea },
      { source: "/order/:path*", headers: privateArea },
      { source: "/order", headers: privateArea },
      { source: "/access/:path*", headers: privateArea },
      { source: "/access", headers: privateArea },
      { source: "/api/:path*", headers: privateArea },
      {
        source: "/assets/themes/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

export default nextConfig;

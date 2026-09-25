/** @type {import('next').NextConfig} */

// The CSP that used to live here moved to `proxy.ts` on 2026-08-07: it now
// carries a per-request nonce so `script-src` can drop 'unsafe-inline', and a
// nonce cannot be minted from a static config. It must NOT be re-added here —
// two Content-Security-Policy headers are intersected by the browser, not
// overridden, so a stale copy would silently break every page. The headers
// below are the ones that are genuinely static.

const nextConfig = {
  // Emit a self-contained server bundle (.next/standalone) for a small Docker image (M10.1).
  output: "standalone",
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Browsers only honor HSTS over HTTPS, so this is inert on local http
          // and takes effect automatically once prod TLS is live (M11.3). No
          // `preload` — that's a hard-to-undo registry commitment, Evan's call.
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
        ],
      },
    ];
  },
};

export default nextConfig;

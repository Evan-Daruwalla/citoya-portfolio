import { NextResponse, type NextRequest } from "next/server";

/**
 * Per-request CSP nonce, so `script-src` no longer needs `'unsafe-inline'`
 * (2026-08-07). This closes the gap ADR-0001 recorded as the known weakness of
 * keeping the JWT in localStorage: the token is readable by any script that
 * runs in the page, so CSP is the only backstop if a stored-XSS hole ever
 * appears — and `'unsafe-inline'` made that backstop inert.
 *
 * Next reads the nonce out of the `Content-Security-Policy` REQUEST header and
 * stamps it onto its own inline bootstrap scripts, which is why the header is
 * set on both the request (for Next) and the response (for the browser).
 *
 * The three static security headers stay in `next.config.mjs`; only the CSP has
 * to be built per request, and it must live in exactly one place — a second CSP
 * header would be intersected with this one by the browser, not replace it.
 */

// Origin of the backend API (scheme + host + port, no path), derived from the
// public API URL by dropping the /api/v1 suffix — needed for connect-src.
// NEXT_PUBLIC_* is inlined at build time, so this is a constant here.
// No try/catch fallback here. It used to swallow a malformed NEXT_PUBLIC_API_URL
// and hand CSP a localhost `connect-src` — but `lib/api.ts` reads the same
// variable unguarded, so every request breaks anyway. The fallback prevented
// nothing and turned a loud build failure into a silent production one
// (audit 2026-09-01). Let it throw.
const apiOrigin = new URL(
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1",
).origin;

// Cloudflare Turnstile (signup bot defense, M11.1) loads its script AND runs its
// challenge in an iframe, so it needs both script-src and frame-src.
const turnstile = "https://challenges.cloudflare.com";

const isDev = process.env.NODE_ENV === "development";

function buildCsp(nonce: string): string {
  return [
    "default-src 'self'",
    // No 'strict-dynamic': it would make the browser IGNORE the Turnstile host
    // allowlist below, and Turnstile is injected by app code as a plain <script>
    // tag. Host-allowlisting it is what keeps that working. 'unsafe-eval' is dev
    // only (Next's HMR needs it); production must never ship it.
    `script-src 'self' 'nonce-${nonce}'${isDev ? " 'unsafe-eval'" : ""} ${turnstile}`,
    // style-src KEEPS 'unsafe-inline' on purpose. A nonce only covers <style>
    // elements, never `style="..."` attributes — and React's `style={{...}}`
    // prop compiles to exactly that attribute, which the v1-era pages use
    // throughout. Dropping it here would break the layout of every screen.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    `connect-src 'self' ${apiOrigin}`,
    `frame-src 'self' ${turnstile}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}

export function proxy(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const csp = buildCsp(nonce);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      // Static assets get no CSP — a policy on a .js or .png file does nothing.
      source: "/((?!_next/static|_next/image|favicon.ico|icon.png|robots.txt|sitemap.xml).*)",
      // Prefetches return RSC payloads, not documents with inline scripts.
      // Minting a nonce for them would cache a value that cannot match the
      // nonce of the document the user actually lands on.
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};

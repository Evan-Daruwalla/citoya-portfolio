import type { Metadata } from "next";
import { DM_Sans, Fraunces } from "next/font/google";
import "./globals.css";
import "./v1.css";
import { AuthProvider } from "@/lib/auth-context";
import { SWRProvider } from "@/components/swr-provider";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { IS_STAGING } from "@/lib/flags";

const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-sans" });
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  // No `weight`: Fraunces is a variable font, so the browser gets one file per style with
  // every weight in it, not one file per listed weight (2026-10-12, audit 2026-10-11 #23).
  // Italic stays in this call: it reaches the page through the same `--font-display`
  // family from a dozen rules (v1.css em, marquee, step numbers, donate / pricing /
  // verify-hours pages), so a separate italic face means touching each of them.
  style: ["normal", "italic"],
  axes: ["opsz"],
});

// A nonce is minted per request, so a page prerendered at build time would ship
// inline scripts stamped with a nonce that no longer matches the header — the
// browser would block Next's own bootstrap and the app would not hydrate at all.
// Inheriting down from the root layout opts every route into per-request
// rendering, which is what makes the strict `script-src` in `proxy.ts` viable
// (2026-08-07). Cheap here: every page is a client shell that fetches from the
// API in the browser, so there was no server-side data work being cached.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: "Citoya",
  description: "Verified community service for students. Free forever.",
  icons: { icon: "/logo.png" },
  openGraph: {
    title: "Citoya",
    description: "Verified community service for students. Free forever.",
    siteName: "Citoya",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
  },
  // Staging: a page reached by a link (robots.txt stops crawling, not indexing of
  // a URL someone links to) still tells the engine not to list it.
  ...(IS_STAGING ? { robots: { index: false, follow: false } } : {}),
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${dmSans.variable} ${fraunces.variable} min-h-screen font-sans antialiased`}>
        <SWRProvider>
        <AuthProvider>
          <div className="flex min-h-screen flex-col">
            {IS_STAGING && (
              <div
                role="status"
                style={{ background: "var(--c-staging-bg)", color: "var(--c-staging-fg)", borderBottom: "1px solid var(--c-staging-border)", fontSize: "var(--fs-label)", textAlign: "center", padding: "8px 16px" }}
              >
                Staging site — not a live service. Accounts and data here are for testing and will be deleted.
              </div>
            )}
            <SiteHeader />
            {/* Deliberately NOT <main>. Every non-`.v1` page already renders its
                own <main> (all 10 of them, verified 2026-08-11), and on a `.v1`
                route V1Shell owns the landmark — putting one here would produce
                two per document, and on `.v1` routes it would additionally wrap
                that shell's nav and footer. The `.v1` routes were the ones
                genuinely missing a landmark; V1Shell is where that was fixed. */}
            <div className="flex-1">{children}</div>
            <SiteFooter />
          </div>
        </AuthProvider>
        </SWRProvider>
      </body>
    </html>
  );
}

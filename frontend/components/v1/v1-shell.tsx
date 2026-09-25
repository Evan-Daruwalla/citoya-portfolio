"use client";

import { Bell } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { ReportConcern } from "@/components/report-concern";
import { useAuth } from "@/lib/auth-context";

// Exact v1 nav + footer chrome (transcribed from ../ServeLocal website/public/index.html),
// wrapping page content in the scoped `.v1` root. Every converted screen uses this.
export function V1Shell({ children }: { children: React.ReactNode }) {
  // `loading` matters: without it this nav rendered signed-OUT chrome while auth
  // was still hydrating, so a signed-in user saw Log In / Sign Up on every cold
  // load and "Dashboard" pointed at /login until /auth/me resolved.
  // site-header.tsx already guarded this window; V1Shell — the nav most users
  // actually see, since it covers every v1 route — did not (audit 2026-09-01).
  const { user, loading, logout } = useAuth();
  const pathname = usePathname();

  // Logged out → send Dashboard to /login (prompt to sign in); logged in → their dash.
  const dashHref =
    user?.role === "org" ? "/applicants" : user?.role === "student" ? "/dashboard" : "/login";

  const nl = (href: string, label: string, active: boolean) => (
    <Link className={`nl${active ? " on" : ""}`} href={href}>
      {label}
    </Link>
  );

  return (
    <div className="v1">
      <nav className="v1-nav" aria-label="Primary">
        <Link href="/" className="nav-logo">
          <Image src="/logo.png" alt="" width={36} height={36} className="brand-logo" unoptimized />
          <span className="nav-wordmark">
            Citoya
          </span>
        </Link>
        <div className="nav-links">
          {nl("/", "Home", pathname === "/")}
          {nl("/discover", "Find Opportunities", pathname === "/discover")}
          {nl(dashHref, "Dashboard", !!user && pathname === dashHref)}
          {nl("/leaderboard", "Community", pathname === "/leaderboard")}
        </div>
        <div className="nav-right">
          {/* Render nothing until auth resolves — asserting "signed out" before
              we know is what produced the logged-out flash. */}
          {loading ? null : user ? (
            <>
              {/* Notifications + inbox lived only in the suppressed shadcn header,
                  orphaning both features on v1 screens (audit 2026-07-13 #3). */}
              <Link className="nl" href="/notifications" aria-label="Notifications" title="Notifications">
                <Bell size={17} strokeWidth={1.75} aria-hidden />
              </Link>
              <Link className="nl" href="/inbox">
                Inbox
              </Link>
              <button className="nav-btn nb-outline" onClick={logout}>
                Log Out
              </button>
            </>
          ) : (
            <>
              <Link className="nav-btn nb-outline" href="/login">
                Log In
              </Link>
              <Link className="nav-btn nb-solid" href="/register">
                Sign Up
              </Link>
            </>
          )}
        </div>
      </nav>

      {/* The `main` landmark for `.v1` routes. It lives HERE rather than in the
          root layout because this shell owns the nav above and the footer below,
          so a `main` at layout level would nest both inside it (audit
          2026-08-11). `PageMain` stands down on these routes for that reason. */}
      <main>{children}</main>

      <footer className="v1-footer">
        <div className="footer-inner">
          <div className="footer-brand">
            <span className="nav-wordmark">
              Citoya
            </span>
            <p>Verified community service for students. Free forever.</p>
          </div>
          <div className="footer-links">
            <Link href="/discover">Find Opportunities</Link>
            <Link href="/leaderboard">Community</Link>
            <Link href="/for-organizations">For Organizations</Link>
            <Link href="/pricing">Pricing</Link>
            <Link href="/donate">Support Us</Link>
            <Link href="/login">Log In</Link>
          </div>
          {/* Year is computed, not hardcoded: it read "© 2026" and would have been
              wrong on every .v1 page from 2027-01-01 (audit 2026-08-08).
              suppressHydrationWarning because the server renders this during SSR and
              the browser re-renders it on hydration — for a few hours each New Year
              those two sit in different calendar years and would otherwise log a
              mismatch. The text is cosmetic, so taking the client's value is right. */}
          <div className="footer-bottom" suppressHydrationWarning>
            © {new Date().getFullYear()} Citoya · Free forever for students. · <Link href="/privacy">Privacy</Link> · <Link href="/terms">Terms</Link> ·{" "}
            <ReportConcern subject="Report a concern" />
          </div>
        </div>
      </footer>
    </div>
  );
}

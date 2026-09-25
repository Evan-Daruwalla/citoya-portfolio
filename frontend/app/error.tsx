"use client";

import { TriangleAlert } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

import { V1Shell } from "@/components/v1/v1-shell";
import { isV1Route } from "@/lib/v1-routes";

/**
 * Route-level error boundary: an uncaught render error anywhere below the root
 * layout lands here instead of on Next's unbranded default screen.
 *
 * `reset()` re-renders the segment without a full page load, which is the right
 * first try for a transient failure. A hard reload is offered as the second,
 * because a stale build's ChunkLoadError survives `reset()` and only a real
 * navigation clears it.
 *
 * The error message itself is deliberately NOT rendered. This app's users
 * include minors, and a thrown error can carry a URL, an id, or a fragment of
 * someone's record; the digest is enough to correlate with the server log.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const pathname = usePathname();

  useEffect(() => {
    // Sentry captures this on its own once a DSN exists (it is env-gated OFF
    // until then). The console line is what a developer has in the meantime.
    console.error("Unhandled render error", error);
  }, [error]);

  // Exactly one set of chrome, whichever route threw. `SiteHeader`/`SiteFooter`
  // in the root layout return null on a v1 route and render everywhere else
  // (`isV1Route`, the same predicate they use), so this page supplies V1Shell
  // only in the case where they bowed out. Getting this backwards puts two navs
  // and two footers on the screen — which is what the first draft did.
  const body = (
    <div className="v1">
      <div className="section" style={{ textAlign: "center", maxWidth: 560 }}>
        <div className="empty-icon" style={{ marginBottom: 8 }}>
          <TriangleAlert size={40} strokeWidth={1.75} aria-hidden />
        </div>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "2rem", margin: "0 0 10px" }}>
          Something went wrong
        </h1>
        <p className="sec-sub" style={{ margin: "0 auto 26px" }}>
          This page didn&apos;t load. Trying again usually works — nothing you saved has
          been lost.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <button className="btn-p" type="button" onClick={reset}>
            Try again
          </button>
          <Link className="btn-s" href="/">
            Go home
          </Link>
        </div>
        {error.digest ? (
          <p style={{ marginTop: 22, fontSize: ".78rem", color: "var(--muted)" }}>
            Reference: {error.digest}
          </p>
        ) : null}
      </div>
    </div>
  );

  return isV1Route(pathname) ? <V1Shell>{body}</V1Shell> : body;
}

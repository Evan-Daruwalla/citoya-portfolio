import Link from "next/link";

// Next renders its own unstyled default when this file is absent — no nav, no
// footer, no way back into the site. Every other failure surface in this app is
// designed (M13.5 skeletons, per-section error+Retry); a mistyped URL was the
// one that was not.
//
// Deliberately NOT wrapped in `V1Shell`. Nothing in the app calls `notFound()`,
// so this renders only for an UNMATCHED url — and `isV1Route` never matches one
// of those, which means `SiteHeader`/`SiteFooter` from the root layout are both
// already on the page. Adding V1Shell here put a second nav and a second footer
// on the screen (caught in the browser, 2026-09-05). The bare `.v1` div is only
// for styling: every class below is a `.v1 .foo` descendant rule in `v1.css`.
export default function NotFound() {
  return (
    <div className="v1">
      <div className="section" style={{ textAlign: "center", maxWidth: 560 }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "2rem", margin: "0 0 10px" }}>
          Page not found
        </h1>
        <p className="sec-sub" style={{ margin: "0 auto 26px" }}>
          That link doesn&apos;t point anywhere. It may have been removed, or the address
          may have a typo in it.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <Link className="btn-p" href="/discover">
            Find opportunities
          </Link>
          <Link className="btn-s" href="/">
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

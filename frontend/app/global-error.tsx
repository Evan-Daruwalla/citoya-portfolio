"use client";

/**
 * The last resort: an error thrown by the ROOT LAYOUT itself.
 *
 * This replaces the whole document, so it must render its own <html> and <body>
 * — and it gets none of the root layout's work: no AuthProvider, no next/font
 * variables, and no guarantee that `globals.css` / `v1.css` were applied. That
 * rules out `V1Shell` (a client component that calls `useAuth`) and every `.v1`
 * class, so the palette below is inlined by hand rather than referenced through
 * the CSS variables that may not exist here.
 *
 * Inline `style` attributes are safe under this app's CSP: `style-src` keeps
 * `'unsafe-inline'` on purpose (`proxy.ts`), while `script-src` does not.
 *
 * Hex values are copied from the `.v1` block in `app/v1.css` — --white #f7f7f1,
 * --text #21352a, --muted #627d6d, --green #175c41, --border #dde7de. If that
 * palette ever changes, this file does not follow automatically.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f7f7f1",
          color: "#21352a",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
          padding: 24,
        }}
      >
        <main style={{ maxWidth: 460, textAlign: "center" }}>
          <p
            style={{
              margin: "0 0 18px",
              fontSize: "1.15rem",
              fontWeight: 700,
              letterSpacing: "-0.01em",
            }}
          >
            Citoya
          </p>
          <h1 style={{ fontSize: "1.5rem", margin: "0 0 10px", letterSpacing: "-0.01em" }}>
            Citoya isn&apos;t loading
          </h1>
          <p style={{ margin: "0 0 24px", color: "#627d6d", lineHeight: 1.7, fontSize: ".92rem" }}>
            Something failed before the site could start. This is on our side, not yours —
            your account and your logged hours are unaffected.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              padding: "13px 26px",
              background: "#175c41",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              fontSize: ".92rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Reload
          </button>
          {error.digest ? (
            <p style={{ marginTop: 22, fontSize: ".78rem", color: "#627d6d" }}>
              Reference: {error.digest}
            </p>
          ) : null}
        </main>
      </body>
    </html>
  );
}

"use client";

/**
 * The applicant identity cell on the two org-facing tables, greyed when the
 * account can no longer take part (Evan, 2026-08-11).
 *
 * The row is KEPT rather than hidden: it is the organization's own record of who
 * signed up. Since 2026-10-09 (Evan's decision 4A) the backend sends "Inactive
 * student" and no email for such a row, so the identity itself is not kept.
 *
 * The hint deliberately does not say WHY. The backend collapses "deleted",
 * "deactivated" and "guardian revoked consent" into one boolean for the same
 * reason — an organization has no business learning that a particular family
 * revoked consent.
 */
export const INACTIVE_ACCOUNT_HINT = "This account has been deactivated or deleted";

export function StudentCell({
  name,
  email,
  inactive,
}: {
  name?: string | null;
  email?: string | null;
  inactive?: boolean;
}) {
  if (!inactive) {
    return (
      <>
        <strong>{name || "—"}</strong>
        {email && (
          <>
            <br />
            <span style={{ fontSize: ".75rem", color: "var(--muted)" }}>{email}</span>
          </>
        )}
      </>
    );
  }
  return (
    // `title` gives the hover text; the visually-hidden span carries the same
    // sentence to screen readers, which do not announce `title` reliably —
    // otherwise the greying would be colour-only information.
    <span title={INACTIVE_ACCOUNT_HINT} style={{ opacity: 0.55 }}>
      <strong style={{ textDecoration: "line-through" }}>{name || "—"}</strong>
      <span className="sr-only"> — {INACTIVE_ACCOUNT_HINT}</span>
      {email && (
        <>
          <br />
          <span style={{ fontSize: ".75rem", color: "var(--muted)", textDecoration: "line-through" }}>
            {email}
          </span>
        </>
      )}
    </span>
  );
}

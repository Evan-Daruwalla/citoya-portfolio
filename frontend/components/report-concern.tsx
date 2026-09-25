import { SUPPORT_LABEL, SUPPORT_MAILTO } from "@/lib/support";

/**
 * "Report a concern" — the platform's abuse-report path (launch review 2026-09-22,
 * L5). Minors and adults meet here, and there was no way to report anything: no
 * route, no link, and an admin "Reports" tab that says it is not built.
 *
 * A mailto to the support inbox, with the subject naming WHAT is reported so the
 * report arrives with its context. The handling procedure is
 * `docs/SUPPORT_PROCEDURES.md` P5. While `NEXT_PUBLIC_SUPPORT_EMAIL` is unset it
 * shows the same visible placeholder as the legal pages, so a production build
 * without it is noticed rather than silently missing its report link.
 */
export function ReportConcern({ subject, label = "Report a concern" }: { subject: string; label?: string }) {
  if (!SUPPORT_MAILTO) return <span>{label}: {SUPPORT_LABEL}</span>;
  return <a href={`${SUPPORT_MAILTO}?subject=${encodeURIComponent(subject)}`}>{label}</a>;
}

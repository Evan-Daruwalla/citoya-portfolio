"use client";

// The hours PDF (M16.2, Evan 2026-09-27): a page laid out for paper, printed with the
// browser's own "Save as PDF", so no PDF library and no new dependency. The dashboard's
// Hours History tab links here with ?print=1, which opens the print dialog once the
// rows are in. Off-site hours are listed and totalled apart, and labelled unverified
// on the page itself, because a PDF travels without the site around it.
import { Lock, Printer } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef } from "react";

import { V1Shell } from "@/components/v1/v1-shell";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { fmtDateKey } from "@/lib/event-time";
import { hoursTotals, reportRows } from "@/lib/hours";
import { HOURS_STATUS_LABEL } from "@/lib/status";
import { useAuthedQuery } from "@/lib/use-api";

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0$/, "");
}

function HoursReport() {
  const { user, loading } = useAuth();
  const isStudent = user?.role === "student";
  const autoPrint = useSearchParams().get("print") === "1";
  // Same key as the dashboard: since M16.3 every student page reads all rows under it.
  const hoursQ = useAuthedQuery(isStudent ? "hours/mine" : null, (t) => api.listAllHours(t));
  const rows = useMemo(() => reportRows(hoursQ.data ?? []), [hoursQ.data]);
  const totals = useMemo(() => hoursTotals(hoursQ.data ?? []), [hoursQ.data]);

  const printed = useRef(false);
  useEffect(() => {
    if (!autoPrint || hoursQ.data === undefined || printed.current) return;
    printed.current = true;
    window.print();
  }, [autoPrint, hoursQ.data]);

  if (loading) return null;
  if (!user || !isStudent) {
    return (
      <V1Shell>
        <div className="section" style={{ maxWidth: 620, textAlign: "center" }}>
          <div className="empty">
            <div className="empty-icon"><Lock size={40} strokeWidth={1.75} aria-hidden /></div>
            Your hours report lives here. <Link href="/login">Log in</Link> as a student to view it.
          </div>
        </div>
      </V1Shell>
    );
  }

  const generated = new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });

  return (
    <V1Shell>
      <div className="section hours-report">
        <div className="no-print hr-actions">
          <button className="btn-p" onClick={() => window.print()} disabled={hoursQ.data === undefined}>
            <Printer size={15} strokeWidth={1.75} aria-hidden /> Save as PDF
          </button>
          <span className="progress-label" style={{ marginTop: 0 }}>In the print window, choose &ldquo;Save as PDF&rdquo; as the destination.</span>
        </div>

        <header className="hr-head">
          <Image src="/logo.png" alt="" width={34} height={34} unoptimized />
          <div>
            <h1 className="hr-title">Volunteer hours</h1>
            <p className="hr-sub">{user.full_name || user.email} &middot; generated {generated} from Citoya</p>
          </div>
        </header>

        {hoursQ.error && hoursQ.data === undefined ? (
          <div className="load-error">
            <div className="ferr">Couldn&apos;t load your hours, so there is nothing to print yet.</div>
            <button className="btn-s" onClick={hoursQ.retry}>Retry</button>
          </div>
        ) : hoursQ.data === undefined ? (
          <p className="progress-label">Loading&hellip;</p>
        ) : (
          <>
            <div className="hr-totals">
              <div><span className="hr-num">{fmt(totals.verified)}</span> verified hours</div>
              <div><span className="hr-num">{fmt(totals.pending)}</span> pending verification</div>
              <div><span className="hr-num">{fmt(totals.offsite)}</span> self-reported, unverified</div>
            </div>

            {rows.length === 0 ? (
              <p className="empty">No hours logged yet.</p>
            ) : (
              <table className="tbl hr-table">
                <thead>
                  <tr><th>Date</th><th>Activity</th><th>Organization</th><th>Hours</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i}>
                      <td>{fmtDateKey(r.date)}</td>
                      <td>{r.title}</td>
                      <td>{r.org ?? "Outside Citoya"}</td>
                      <td>{fmt(r.hours)}</td>
                      <td>{HOURS_STATUS_LABEL[r.status] ?? r.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <p className="hr-note">
              <strong>Verified</strong> hours were confirmed by the organization that ran the event on Citoya.{" "}
              <strong>Pending</strong> hours are waiting for that organization.{" "}
              <strong>Self-reported, unverified</strong> hours are volunteering the student logged outside Citoya;
              no organization on Citoya has confirmed them, and they are not included in the verified total.
            </p>
          </>
        )}
      </div>
    </V1Shell>
  );
}

// useSearchParams needs a Suspense boundary in the App Router (same as /login).
export default function HoursReportPage() {
  return (
    <Suspense fallback={null}>
      <HoursReport />
    </Suspense>
  );
}

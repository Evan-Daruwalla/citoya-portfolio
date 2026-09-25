"use client";

import { TriangleAlert } from "lucide-react";

import { ReportConcern } from "@/components/report-concern";
import { useAuth } from "@/lib/auth-context";

/** Shown to a signed-in organization that a human has not yet approved (M15.1).
 *
 *  Without it a pending org sees its listings saved, its dashboard normal, and no
 *  volunteers ever arriving, with nothing on screen explaining why. There is no
 *  action to offer — the org cannot do anything to speed up a queue of one person —
 *  so the only control is a refresh for after the approval lands.
 */
export function OrgReviewBanner() {
  const { user, refresh } = useAuth();

  if (!user || user.role !== "org" || user.is_approved) return null;

  // M15.2: an admin decided NO. Before `org_reviewed_at` existed this org would have
  // been told "being reviewed" forever, by the same banner, after the decision.
  if (user.org_reviewed_at) {
    return (
      <div className="consent-zone">
        <h4>
          <TriangleAlert size={16} strokeWidth={1.75} aria-hidden />
          Your organization wasn&apos;t approved
        </h4>
        <p>
          Students can&apos;t see your listings.{" "}
          <ReportConcern subject="Organization review decision" label="Contact us if you think this is a mistake" />
        </p>
      </div>
    );
  }

  // v1 editorial styling (.consent-zone), not shadcn/Tailwind, for the same reason
  // ConsentBanner gives: this renders inside the .v1 shell, where a generic amber
  // utility box reads as foreign.
  return (
    <div className="consent-zone">
      <h4>
        <TriangleAlert size={16} strokeWidth={1.75} aria-hidden />
        Your organization is being reviewed
      </h4>
      <p>
        Your listings are saved and you can see them here, but students can&apos;t see them yet.
        {/* A TARGET, not a guarantee. "will be reviewed within 3 business days" is a
            promise nobody has committed to keeping (PRD_ROADMAP.md M15.1, Evan
            2026-09-20). The wording difference is the whole decision. */}
        {" "}We aim to review new organizations within 3 business days.
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <button className="btn-s" style={{ padding: "9px 18px", fontSize: ".83rem" }} onClick={refresh}>
          I&apos;ve been approved. Refresh
        </button>
      </div>
    </div>
  );
}

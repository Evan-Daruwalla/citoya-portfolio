"use client";

import { TriangleAlert } from "lucide-react";
import { useState } from "react";

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
  const [message, setMessage] = useState<string | null>(null);

  if (!user || user.role !== "org" || user.is_approved) return null;

  // M15.2: an admin decided NO. Before `org_reviewed_at` existed this org would have
  // been told "being reviewed" forever, by the same banner, after the decision.
  if (user.org_reviewed_at) {
    return (
      <div className="consent-zone">
        <h4>
          <TriangleAlert size={16} strokeWidth={1.75} aria-hidden />
          Your organization was not approved
        </h4>
        <p>
          Students cannot see your listings.{" "}
          <ReportConcern subject="Organization review decision" label="Contact us if you think this is a mistake" />
        </p>
      </div>
    );
  }

  // audit DY Med 21, 2026-10-05: a failed refresh used to reject unhandled and the
  // click did nothing visible.
  async function recheck() {
    setMessage(null);
    try {
      await refresh();
    } catch {
      setMessage("Could not check your status. Try again.");
    }
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
        Your listings are saved and you can see them here, but students cannot see them yet.
        {/* A TARGET, not a guarantee. "will be reviewed within 3 business days" is a
            promise nobody has committed to keeping (PRD_ROADMAP.md M15.1, Evan
            2026-09-20). The wording difference is the whole decision. */}
        {" "}We aim to review new organizations within 3 business days.
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <button className="btn-s btn-sm" onClick={recheck}>
          I have been approved. Refresh
        </button>
      </div>
      {message && <p style={{ marginTop: 10, marginBottom: 0 }}>{message}</p>}
    </div>
  );
}

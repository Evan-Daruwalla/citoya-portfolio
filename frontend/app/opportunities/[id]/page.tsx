"use client";

import { CalendarDays, Clock, Globe, MapPin, RefreshCw, Shuffle, Timer, Users, WifiOff } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

import { ReportConcern } from "@/components/report-concern";
import { V1Shell } from "@/components/v1/v1-shell";
import { ApiError, api } from "@/lib/api";
import { TOKEN_KEY, useAuth } from "@/lib/auth-context";
import { CONSENT_GATED_COPY, consentGated } from "@/lib/consent";
import { fmtEventDateTime } from "@/lib/event-time";
import { usePublicQuery } from "@/lib/use-api";
import { MessagesSection } from "./messages-section";
import { OrgCheckinSection } from "./org-checkin-section";
import { ReviewsSection } from "./reviews-section";
import { SignupSection } from "./signup-section";

const RECURRENCE_LABEL: Record<string, string> = {
  one_time: "One-time",
  weekly: "Weekly",
  monthly: "Monthly",
};

export default function OpportunityDetailPage() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  // Public: a shared listing link must render for a signed-out visitor, so this
  // stays `usePublicQuery` and must not wait on auth hydration. The token is read
  // at FETCH time, never at render time — `use-api.ts` does the same, because
  // touching localStorage during render differs between server and client.
  //
  // Passing it at all is new (2026-09-20, M15.1): this call sent no Authorization
  // header, so the backend's viewer-dependent branches were dead in the browser.
  // The key carries WHO is asking (F23, audit 2026-09-24): the answer is viewer-
  // dependent (an owner sees an unapproved listing, everyone else a 404), so a
  // signed-out 404 must not be served to the signed-in owner from cache. `user`,
  // not the token, because the token must not be read during render.
  const { data: opp, loading, error, retry } = usePublicQuery(
    `opportunities/${params.id}:${user?.id ?? "anon"}`,
    () => api.getOpportunity(params.id, localStorage.getItem(TOKEN_KEY) ?? undefined),
  );
  // The WRITE's error is kept separate from the LOAD's. One `error` string used
  // to serve both, so a failed Feature toggle and a failed page load rendered
  // the same red line, and either one cleared the other.
  const [actionError, setActionError] = useState<string | null>(null);
  const [featuring, setFeaturing] = useState(false);

  async function toggleFeatured() {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token || !opp) return;
    setFeaturing(true);
    setActionError(null);
    try {
      await api.setFeatured(opp.id, !opp.featured, token);
      retry();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not update the listing.");
    } finally {
      setFeaturing(false);
    }
  }

  const loc = (opp?.location || "").toLowerCase();
  const fmt = opp?.format || "";
  const isRemote = fmt.toLowerCase() === "remote" || loc.includes("remote");
  const isHybrid = fmt.toLowerCase() === "hybrid" || loc.includes("hybrid");
  const isRecurring = opp?.recurrence !== "one_time";

  return (
    <V1Shell>
      <Link href="/discover" className="back-link">
        ← Back to Opportunities
      </Link>

      {actionError && <div className="detail-wrap"><p style={{ color: "var(--red)" }}>{actionError}</p></div>}

      {/* There was no loading state at all before this conversion: a slow load
          rendered the back-link over an empty page, indistinguishable from a
          listing that had been deleted. */}
      {loading && (
        <div className="detail-wrap">
          <div className="loading"><div className="spinner" /><div>Loading…</div></div>
        </div>
      )}

      {!loading && error && (
        <div className="detail-wrap">
          <div className="empty">
            <div className="empty-icon"><WifiOff size={40} strokeWidth={1.75} aria-hidden /></div>
            {error instanceof ApiError && error.status >= 400 && error.status < 500
              ? error.message
              : "Couldn't load this opportunity. Check your connection and try again."}
            <div style={{ marginTop: 14 }}>
              <button className="btn-s" onClick={retry}>Retry</button>
            </div>
          </div>
        </div>
      )}

      {opp && (
        <div className="detail-wrap">
          <div className="modal-card">
            <div className="mhdr">
              <div className="mtitle">{opp.title}</div>
              <div className="msub">{opp.org_name}</div>
            </div>
            <div className="mbody">
              <div className="badges-row" style={{ marginBottom: 14 }}>
                {opp.featured && <span className="badge badge-featured">★ Featured</span>}
                <span className="badge badge-verified">Open to All</span>
              </div>

              <div style={{ marginBottom: 12 }}>
                {isRemote ? (
                  <span className="format-pip remote" style={{ fontSize: ".8rem", padding: "4px 12px" }}><Globe size={12} strokeWidth={1.75} aria-hidden />Remote</span>
                ) : isHybrid ? (
                  <span className="format-pip hybrid" style={{ fontSize: ".8rem", padding: "4px 12px" }}><Shuffle size={12} strokeWidth={1.75} aria-hidden />Hybrid</span>
                ) : (
                  <span className="format-pip inperson" style={{ fontSize: ".8rem", padding: "4px 12px" }}><MapPin size={12} strokeWidth={1.75} aria-hidden />In-Person</span>
                )}
              </div>

              <div className="detail-grid">
                <div><MapPin size={14} strokeWidth={1.75} aria-hidden /> <strong>Location:</strong> {opp.location}</div>
                <div><CalendarDays size={14} strokeWidth={1.75} aria-hidden /> <strong>Start:</strong> {fmtEventDateTime(opp.start_time, opp.timezone)}</div>
                <div><Clock size={14} strokeWidth={1.75} aria-hidden /> <strong>End:</strong> {fmtEventDateTime(opp.end_time, opp.timezone)}</div>
                <div><Timer size={14} strokeWidth={1.75} aria-hidden /> <strong>Duration:</strong> {opp.duration_hours} hours</div>
                <div><RefreshCw size={14} strokeWidth={1.75} aria-hidden /> <strong>Commitment:</strong> {RECURRENCE_LABEL[opp.recurrence]}</div>
                {!isRecurring && (
                  <div><Users size={14} strokeWidth={1.75} aria-hidden /> <strong>Spots:</strong> {opp.spots_remaining}/{opp.spots_available} remaining</div>
                )}
              </div>

              <div className="detail-label">Description</div>
              <p className="detail-desc">{opp.description}</p>
              <p style={{ fontSize: ".78rem", color: "var(--muted)", marginTop: 0 }}>
                <ReportConcern subject={`Report a listing: ${opp.title} (${opp.id})`} label="Report this listing" />
              </p>

              {opp.skills.length > 0 && (
                <>
                  <div className="detail-label">Skills Needed</div>
                  <div className="badges-row" style={{ marginBottom: 16 }}>
                    {opp.skills.map((s) => (
                      <span key={s} className="badge badge-skill">
                        {s}
                      </span>
                    ))}
                  </div>
                </>
              )}

              {user?.role === "student" &&
                (consentGated(user) ? (
                  <p className="progress-label">{CONSENT_GATED_COPY}</p>
                ) : (
                  <SignupSection opp={opp} onChange={retry} />
                ))}
            </div>
          </div>

          {user?.role === "org" && user.id === opp.org_id && (
            <div className="modal-card" style={{ marginTop: 16 }}>
              <div className="mbody" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 600, color: "var(--dark)", fontSize: ".9rem" }}>Featured listing</div>
                  <div style={{ fontSize: ".8rem", color: "var(--muted)" }}>
                    {user.plan === "pro" ? "Featured listings appear first in Discover (up to 3)." : "Upgrade to Pro to feature this listing."}
                  </div>
                </div>
                {user.plan === "pro" ? (
                  <button
                    className={opp.featured ? "btn-s" : "btn-p"}
                    type="button"
                    disabled={featuring}
                    onClick={toggleFeatured}
                    style={{ padding: "9px 18px", fontSize: ".83rem", whiteSpace: "nowrap" }}
                  >
                    {opp.featured ? "Unfeature" : "Feature"}
                  </button>
                ) : (
                  <Link className="btn-s" href="/billing" style={{ padding: "9px 18px", fontSize: ".83rem", whiteSpace: "nowrap", textDecoration: "none" }}>
                    Upgrade
                  </Link>
                )}
              </div>
            </div>
          )}

          <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 16 }}>
            {user?.role === "org" && user.id === opp.org_id && <OrgCheckinSection opp={opp} />}
            <MessagesSection opportunityId={opp.id} orgId={opp.org_id} canPost={user?.role === "org" && user.id === opp.org_id} />
            <ReviewsSection orgId={opp.org_id} opportunityId={opp.id} />
          </div>
        </div>
      )}
    </V1Shell>
  );
}

"use client";

import { CalendarDays, WifiOff } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { ReviewsSection } from "@/components/reviews-section";
import { V1Shell } from "@/components/v1/v1-shell";
import { ApiError, api } from "@/lib/api";
import { TOKEN_KEY, useAuth } from "@/lib/auth-context";
import { fmtEventDate } from "@/lib/event-time";
import { usePublicQuery } from "@/lib/use-api";

// An organization's public page (PRD M17.1, 2026-10-06): its name, the listings
// Discover would show for it, and its reviews.
export default function OrganizationPage() {
  const params = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  // Public: a shared link must render for a signed-out visitor, so `usePublicQuery`.
  // The answer is viewer-dependent, like the listing page's: the org itself and an
  // admin see an unapproved page, everyone else a 404. So the token is passed (read at
  // FETCH time, never at render) and the key carries WHO is asking and waits for auth
  // to settle, exactly as `opportunities/[id]/page.tsx` does (F23, record CQ).
  const { data: org, loading: orgLoading, error, retry } = usePublicQuery(
    authLoading ? null : `orgs/${params.id}:${user?.id ?? "anon"}`,
    () => api.publicOrg(params.id, localStorage.getItem(TOKEN_KEY) ?? undefined),
  );
  const loading = authLoading || orgLoading;
  // Listings are not viewer-dependent (the server filters them as Discover does), so
  // no token and no user in the key. Held back until the org itself has loaded, so a
  // 404 org never fires a second request.
  const {
    data: opps,
    loading: oppsLoading,
    error: oppsError,
    retry: retryOpps,
  } = usePublicQuery(org ? `opportunities:org:${params.id}` : null, () =>
    api.listAllOpportunities({ org_id: params.id }),
  );

  const notFound = error instanceof ApiError && error.status === 404;

  return (
    <V1Shell>
      <Link href="/discover" className="back-link">
        ← Back to opportunities
      </Link>

      {loading && (
        <div className="detail-wrap">
          <div className="loading"><div className="spinner" /><div>Loading…</div></div>
        </div>
      )}

      {!loading && notFound && (
        <div className="detail-wrap">
          <div className="empty">Organization not found.</div>
        </div>
      )}

      {!loading && error && !notFound && (
        <div className="detail-wrap">
          <div className="empty">
            <div className="empty-icon"><WifiOff size={40} strokeWidth={1.75} aria-hidden /></div>
            Could not load this organization. Check your connection and try again.
            <div style={{ marginTop: 14 }}>
              <button className="btn-s" onClick={retry}>Retry</button>
            </div>
          </div>
        </div>
      )}

      {org && (
        <div className="section">
          <h1 className="sec-title">{org.name}</h1>

          <div className="detail-label">Current opportunities</div>
          {oppsLoading && (
            <div className="loading"><div className="spinner" /><div>Loading…</div></div>
          )}
          {!oppsLoading && oppsError && (
            <div className="empty">
              Could not load this organization&apos;s opportunities.
              <div style={{ marginTop: 14 }}>
                <button className="btn-s" onClick={retryOpps}>Retry</button>
              </div>
            </div>
          )}
          {opps && opps.length === 0 && <div className="empty">No current opportunities.</div>}
          {opps && opps.length > 0 && (
            <div className="cards-grid">
              {opps.map((o) => (
                <Link key={o.id} href={`/opportunities/${o.id}`} className="opp-card">
                  <div className="oc-title">{o.title}</div>
                  <div className="oc-meta">
                    <span><CalendarDays size={13} strokeWidth={1.75} aria-hidden />{fmtEventDate(o.start_time, o.timezone)}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}

          <div style={{ marginTop: 24 }}>
            <ReviewsSection orgId={params.id} />
          </div>
        </div>
      )}
    </V1Shell>
  );
}

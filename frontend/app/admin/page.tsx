"use client";

import { BadgeCheck, Flag, Landmark, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { V1Shell } from "@/components/v1/v1-shell";
import { api, ApiError, TOKEN_KEY } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { eventInstant } from "@/lib/event-time";
import { useAuthedQuery, usePublicQuery } from "@/lib/use-api";
import type { AdminOrg, RouteHitRead, TrafficSummary } from "@/lib/types";

type Tab = "pending" | "all-orgs" | "reports";

const TABS: { id: Tab; label: string }[] = [
  { id: "pending", label: "Pending Orgs" },
  { id: "all-orgs", label: "All Orgs" },
  { id: "reports", label: "Reports" },
];

// ── M14.1 site traffic ──
type TrafficDays = 7 | 30 | 90;
const TRAFFIC_WINDOWS: TrafficDays[] = [7, 30, 90];
// The API has ~75 route templates and a 30-day window returns 300+ raw rows, so the
// table shows the head of the distribution rather than everything.
const TOP_ROUTES = 15;

type RouteTotal = { route: string; method: string; count: number };

/** Sum `count` per (route, method) across the whole window; top N plus how many exist. */
function topRoutes(rows: RouteHitRead[], n: number): { top: RouteTotal[]; distinct: number } {
  const acc = new Map<string, RouteTotal>();
  for (const r of rows) {
    const k = `${r.method} ${r.route}`;
    const cur = acc.get(k);
    if (cur) cur.count += r.count;
    else acc.set(k, { route: r.route, method: r.method, count: r.count });
  }
  const all = [...acc.values()].sort((a, b) => b.count - a.count || a.route.localeCompare(b.route));
  return { top: all.slice(0, n), distinct: all.length };
}

/** One entry per day from since..until inclusive, zero-filled.
 *  Dates are walked in UTC: the backend keys rows by UTC day, and constructing a
 *  bare `new Date("2026-09-02")` then reading local getters shifts the label back a
 *  day in any negative-offset zone, which is every US timezone. */
function dailyTotals(t: TrafficSummary): { day: string; count: number }[] {
  const byDay = new Map<string, number>();
  for (const r of t.rows) byDay.set(r.day, (byDay.get(r.day) ?? 0) + r.count);
  const out: { day: string; count: number }[] = [];
  const d = new Date(`${t.since}T00:00:00Z`);
  const end = new Date(`${t.until}T00:00:00Z`);
  while (d <= end) {
    const iso = d.toISOString().slice(0, 10);
    out.push({ day: iso, count: byDay.get(iso) ?? 0 });
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

function fmtDay(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export default function AdminPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("pending");
  // Both endpoints are public; the admin gate on this page is about not showing
  // an operator surface to visitors, not about these two reads. Held (null key)
  // until the admin check passes so a non-admin never fires them.
  // `error` is read, not just `data`: with `?? 0` alone a failed fetch and "zero
  // organizations on the platform" rendered identically. The fourth tile below
  // already hardcodes "—", which is the glyph this project uses for a failed
  // stat (audit 2026-09-02).
  const { data: stats, error } = usePublicQuery(
    user?.is_admin ? "admin/stats" : null,
    async () => {
      const [opps, board] = await Promise.all([api.listOpportunities({}), api.leaderboard()]);
      return { opps: opps.length, orgs: new Set(opps.map((o) => o.org_id)).size, students: board.length };
    },
  );

  const [days, setDays] = useState<TrafficDays>(30);
  // The key carries the window: 7/30/90 are three datasets, so three cache entries.
  // Held null until `is_admin` so a non-admin never SENDS the request (the server
  // 403s it regardless; this stops it existing). No `keepPreviousData` — a 30-day
  // dataset must never render under a "7 days" label while the new window loads.
  const {
    data: traffic,
    error: trafficError,
    loading: trafficLoading,
    retry: retryTraffic,
  } = useAuthedQuery(
    user?.is_admin ? `analytics/traffic?days=${days}` : null,
    (t) => api.siteTraffic(days, t),
  );

  // M15.2 organization review. Three states, three cache entries: a decision moves
  // an org between them, so every decision revalidates all three. Held null until
  // `is_admin`, like the traffic query above.
  const pendingQ = useAuthedQuery(user?.is_admin ? "admin/orgs?status=pending" : null, (t) =>
    api.adminOrgs("pending", t),
  );
  const approvedQ = useAuthedQuery(user?.is_admin ? "admin/orgs?status=approved" : null, (t) =>
    api.adminOrgs("approved", t),
  );
  const rejectedQ = useAuthedQuery(user?.is_admin ? "admin/orgs?status=rejected" : null, (t) =>
    api.adminOrgs("rejected", t),
  );
  // T5: an invite in a spam folder records nothing anywhere else.
  const { data: overdue, error: overdueError } = useAuthedQuery(
    user?.is_admin ? "admin/consent/overdue" : null,
    (t) => api.consentOverdue(t),
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [decideError, setDecideError] = useState<string | null>(null);

  async function decide(org: AdminOrg, approve: boolean) {
    // Rejecting notifies the organization AND withdraws every student on its rosters
    // (A2, 2026-09-23), so a mis-click is not silent; approving
    // is what the queue is for and is one click.
    if (!approve && !window.confirm(`Reject ${org.full_name ?? org.email}? Their listings are hidden, every student signed up to them is withdrawn and told, and the organization is told.`)) return;
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;
    setBusyId(org.id);
    setDecideError(null);
    try {
      await (approve ? api.approveOrg : api.rejectOrg)(org.id, token);
      void pendingQ.mutate();
      void approvedQ.mutate();
      void rejectedQ.mutate();
    } catch (err) {
      setDecideError(err instanceof ApiError ? err.message : "Couldn't save that decision.");
    } finally {
      setBusyId(null);
    }
  }

  // This page had NO gate: any visitor got an "Admin — Citoya Dashboard" with
  // platform-wide counts (audit 2026-08-05). The real authorization is server-side
  // on every admin route (is_platform_admin); this just stops rendering an
  // operator surface to the public.
  useEffect(() => {
    if (!loading && !user?.is_admin) router.replace("/");
  }, [loading, user, router]);


  if (loading || !user?.is_admin) return null;

  const { top, distinct } = traffic
    ? topRoutes(traffic.rows, TOP_ROUTES)
    : { top: [] as RouteTotal[], distinct: 0 };
  const daily = traffic ? dailyTotals(traffic) : [];
  const peak = Math.max(1, ...daily.map((d) => d.count));
  const labelEvery = Math.ceil(days / 6); // ~6 labels at any window width

  const fmtWhen = (iso: string) =>
    eventInstant(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

  /** One review state as a table; `approve` says which way this state's button moves an
   *  org, and only the pending queue also offers Reject. */
  function orgTable(
    q: { data?: AdminOrg[]; error?: ApiError; loading: boolean; retry: () => void },
    approve: boolean,
    actionLabel: string,
    emptyText: string,
    offerReject = false,
  ) {
    // Data outranks error (conventions.md): after a decision, a failed revalidation must
    // not replace a working table with an error panel.
    if (q.error && !q.data) {
      return (
        <div className="load-error">
          <div className="ferr">Couldn&apos;t load organizations.</div>
          <div>
            <button className="btn-s" style={{ padding: "9px 18px", fontSize: ".83rem" }} onClick={q.retry}>Retry</button>
          </div>
        </div>
      );
    }
    if (q.loading || !q.data) return <div className="skel-card" aria-busy="true"><div className="skel skel-line" style={{ width: "70%" }} /></div>;
    if (q.data.length === 0) return <div className="empty">{emptyText}</div>;
    return (
      <>
      {q.error && <p className="progress-label">Couldn&apos;t refresh — showing the last list we loaded.</p>}
      <table className="tbl">
        <thead>
          <tr>
            <th scope="col">Organization</th>
            <th scope="col">Registered</th>
            <th scope="col" style={{ textAlign: "right" }}>Listings</th>
            <th scope="col">Reviewed</th>
            <th scope="col"><span className="sr-only">Action</span></th>
          </tr>
        </thead>
        <tbody>
          {q.data.map((o) => (
            <tr key={o.id}>
              <td>
                <strong>{o.full_name ?? "(no name)"}</strong>
                <br />
                <span style={{ fontSize: ".8rem", color: "var(--muted)" }}>{o.email}</span>
              </td>
              <td>{fmtWhen(o.created_at)}</td>
              <td className="traffic-num" style={{ textAlign: "right" }}>{o.listing_count}</td>
              <td>{o.reviewed_at ? fmtWhen(o.reviewed_at) : "—"}</td>
              <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                {offerReject && (
                  <button className="btn-s" style={{ padding: "7px 14px", fontSize: ".8rem", marginRight: 6 }} disabled={busyId === o.id} onClick={() => decide(o, false)}>
                    Reject
                  </button>
                )}
                <button className={approve ? "btn-p" : "btn-s"} style={{ padding: "7px 14px", fontSize: ".8rem" }} disabled={busyId === o.id} onClick={() => decide(o, approve)}>
                  {actionLabel}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </>
    );
  }

  return (
    <V1Shell>
      <div className="section">
        <div className="sec-tag">Admin</div>
        <h2 className="sec-title" style={{ marginBottom: 24 }}>Citoya Dashboard</h2>

        {/* Honest banner. Org review is built (M15.2, 2026-09-22); the other two
            moderation tools are still not screens here, and it says so. */}
        <div className="ferr" style={{ display: "block", background: "#fff8e1", borderColor: "#ffc107", color: "#795548", marginBottom: 24 }}>
          Organization review works below. Reports arrive by email through the &ldquo;Report a
          concern&rdquo; links, and the audit log is readable through the API only.
        </div>

        <div className="admin-grid">
          <div className="admin-stat"><div className="admin-stat-num">{error ? "—" : (stats?.opps ?? 0)}</div><div className="admin-stat-label">Opportunities</div></div>
          <div className="admin-stat"><div className="admin-stat-num">{error ? "—" : (stats?.orgs ?? 0)}</div><div className="admin-stat-label">Organizations</div></div>
          <div className="admin-stat"><div className="admin-stat-num">{error ? "—" : (stats?.students ?? 0)}</div><div className="admin-stat-label">Ranked Students</div></div>
          <div className="admin-stat"><div className="admin-stat-num">{pendingQ.data && !pendingQ.error ? pendingQ.data.length : "—"}</div><div className="admin-stat-label">Pending Review</div></div>
          {/* A deliverability signal, not a to-do list: it carries no names, so nobody can
              be chased from it. Non-zero and rising means invites are landing in spam —
              docs/SUPPORT_PROCEDURES.md P6. */}
          <div className="admin-stat"><div className="admin-stat-num">{overdue && !overdueError ? overdue.count : "—"}</div><div className="admin-stat-label">Guardian invites expired unanswered{overdue ? ` (>${overdue.hours}h)` : ""}</div></div>
          {/* Loading and failure both read "—". A number here means real data. */}
          <div className="admin-stat"><div className="admin-stat-num traffic-num">{traffic ? traffic.total.toLocaleString() : "—"}</div><div className="admin-stat-label">Requests · {days}d</div></div>
        </div>

        {/* M14.1. `route_hits` has no user, IP, session or opportunity column, so this
            section reports REQUEST COUNTS and must never say "visitors" or "views" —
            app/privacy/page.tsx makes that promise to the public. */}
        <section aria-labelledby="traffic-h" style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap", marginBottom: 14 }}>
            <div>
              <h3 id="traffic-h" style={{ fontSize: "1.1rem", color: "var(--dark)", marginBottom: 4 }}>Site traffic</h3>
              <p className="sec-sub" style={{ fontSize: ".82rem", margin: 0 }}>
                Successful API requests per route, counted server-side. Request counts only — no cookies, no per-person data.
              </p>
            </div>
            <div className="tabs" role="group" aria-label="Traffic window" style={{ marginBottom: 0 }}>
              {TRAFFIC_WINDOWS.map((d) => (
                <button key={d} type="button" className={`tab${days === d ? " on" : ""}`} aria-pressed={days === d} onClick={() => setDays(d)}>
                  {d} days
                </button>
              ))}
            </div>
          </div>

          {trafficError ? (
            <div className="load-error">
              <div className="empty-icon"><TriangleAlert size={40} strokeWidth={1.75} aria-hidden /></div>
              <div className="ferr">Couldn&apos;t load site traffic. Check your connection and try again.</div>
              <div>
                <button className="btn-s" style={{ padding: "9px 18px", fontSize: ".83rem" }} onClick={retryTraffic}>
                  Retry
                </button>
              </div>
            </div>
          ) : trafficLoading || !traffic ? (
            /* `!traffic` matters: just after a window switch the hook is neither
               loading nor errored with data still undefined, and that instant must
               show the skeleton, never the "no requests" copy. */
            <div className="skel-card" aria-busy="true">
              <div className="skel skel-line" style={{ width: "55%", height: 16, marginBottom: 14 }} />
              <div className="skel skel-line" style={{ width: "100%", marginBottom: 8 }} />
              <div className="skel skel-line" style={{ width: "92%", marginBottom: 8 }} />
              <div className="skel skel-line" style={{ width: "78%" }} />
            </div>
          ) : traffic.total === 0 ? (
            <div className="empty">No requests recorded in this window ({traffic.since} to {traffic.until}).</div>
          ) : (
            <>
              <ol className="traffic-bars" aria-label="Requests per day">
                {daily.map((d) => (
                  <li key={d.day}>
                    <div
                      className={`traffic-bar${d.count === 0 ? " zero" : ""}`}
                      style={d.count ? { height: `${Math.max(2, Math.round((d.count / peak) * 100))}%` } : undefined}
                      title={`${fmtDay(d.day)}: ${d.count.toLocaleString()} requests`}
                    />
                    <span className="sr-only">{fmtDay(d.day)}: {d.count.toLocaleString()} requests</span>
                  </li>
                ))}
              </ol>
              <div className="traffic-axis" aria-hidden>
                {daily.map((d, i) => (
                  <span key={d.day}>{i % labelEvery === 0 || i === daily.length - 1 ? fmtDay(d.day) : ""}</span>
                ))}
              </div>

              <table className="tbl">
                <caption className="sr-only">Top {TOP_ROUTES} routes by successful requests, {traffic.since} to {traffic.until}</caption>
                <thead>
                  <tr>
                    <th scope="col">Route</th>
                    <th scope="col">Method</th>
                    <th scope="col" style={{ textAlign: "right" }}>Requests</th>
                  </tr>
                </thead>
                <tbody>
                  {top.map((r) => (
                    <tr key={`${r.method} ${r.route}`}>
                      <td style={{ fontFamily: "ui-monospace, monospace", fontSize: ".8rem" }}>{r.route}</td>
                      <td>{r.method}</td>
                      <td className="traffic-num" style={{ textAlign: "right" }}>{r.count.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p style={{ fontSize: ".75rem", color: "var(--muted)", marginTop: 8 }}>
                {distinct > TOP_ROUTES ? `Top ${TOP_ROUTES} of ${distinct} route/method pairs · ` : ""}
                {traffic.since} to {traffic.until}, UTC days.
              </p>
            </>
          )}
        </section>

        <div className="tabs">
          {TABS.map((t) => (
            <button key={t.id} className={`tab${tab === t.id ? " on" : ""}`} onClick={() => setTab(t.id)}>{t.label}</button>
          ))}
        </div>

        <div className="tab-panel on">
          {decideError && <p className="ferr" role="alert">{decideError}</p>}
          {tab === "pending" && (
            <>
              <p className="sec-sub" style={{ fontSize: ".82rem", marginTop: 0 }}>
                <BadgeCheck size={14} strokeWidth={1.75} aria-hidden /> Oldest first. Approving shows the organization&apos;s listings to students at once; both decisions notify the organization.
              </p>
              {orgTable(pendingQ, true, "Approve", "No organizations are waiting for review.", true)}
            </>
          )}
          {tab === "all-orgs" && (
            <>
              <h3 style={{ fontSize: "1rem", color: "var(--dark)", margin: "0 0 8px" }}><Landmark size={16} strokeWidth={1.75} aria-hidden /> Approved</h3>
              {orgTable(approvedQ, false, "Withdraw approval", "No approved organizations.")}
              <h3 style={{ fontSize: "1rem", color: "var(--dark)", margin: "20px 0 8px" }}>Rejected</h3>
              {orgTable(rejectedQ, true, "Approve", "No rejected organizations.")}
            </>
          )}
          {tab === "reports" && (
            <div className="empty"><div className="empty-icon"><Flag size={40} strokeWidth={1.75} aria-hidden /></div>Reports arrive by email through the &ldquo;Report a concern&rdquo; links (procedure P5). The audit log is readable through the API (<code>GET /api/v1/audit-log</code>); it has no screen here.</div>
          )}
        </div>
      </div>
    </V1Shell>
  );
}

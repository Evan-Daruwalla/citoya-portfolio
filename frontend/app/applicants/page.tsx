"use client";

import { Archive, BadgeCheck, CalendarDays, ClipboardList, Clock, Download, Globe, Landmark, LogOut, MapPin, MessageCircle, RefreshCw, Shuffle, Star, TrendingUp, TriangleAlert, Users, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { CategoryIcon, getCategoryMeta } from "@/components/v1/category-icon";
import { OrgReviewBanner } from "@/components/org-review-banner";
import { StudentCell } from "@/components/student-cell";
import { V1Shell } from "@/components/v1/v1-shell";
import { ApiError, api } from "@/lib/api";
import { useAuthedQuery } from "@/lib/use-api";
import { TOKEN_KEY, useAuth } from "@/lib/auth-context";
import { toCsv } from "@/lib/csv";
import { eventDateKey, fmtDateKey, fmtEventDate, localDateKey } from "@/lib/event-time";
import type { Opportunity } from "@/lib/types";

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type Tab = "listings" | "analytics" | "calendar" | "applicants" | "hours" | "history" | "profile";
type Audience = "all" | "approved" | "pending";

const TABS: { id: Tab; label: string; Icon: LucideIcon }[] = [
  { id: "listings", label: "My Listings", Icon: ClipboardList },
  { id: "analytics", label: "Analytics", Icon: TrendingUp },
  { id: "calendar", label: "Calendar", Icon: CalendarDays },
  { id: "applicants", label: "Applicants", Icon: Users },
  { id: "hours", label: "Verify Hours", Icon: BadgeCheck },
  { id: "history", label: "Listing History", Icon: Archive },
  { id: "profile", label: "Org Profile", Icon: Landmark },
];

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

// Module-scope (stable identity) so useMemo deps stay honest — see [opps, nowMs].
const isRecurring = (o: Opportunity) => o.recurrence !== "one_time";
const isExpired = (o: Opportunity, nowMs: number) =>
  !isRecurring(o) && !!o.end_time && new Date(o.end_time).getTime() < nowMs;

export default function OrgDashboardPage() {
  const { user, logout, loading } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("listings");
  // Every key is held null until the user is an org, so a student never sends a
  // request the server would 403 anyway.
  const isOrg = user?.role === "org";
  const {
    data: orgStats,
    error: orgStatsError,
    loading: orgStatsLoading,
    retry: retryOrgStats,
  } = useAuthedQuery(isOrg ? "analytics/org" : null, (t) => api.orgAnalytics(t));
  const oppsQ = useAuthedQuery(isOrg ? "opportunities/mine" : null, (t) => api.myOpportunities(t));
  const appsQ = useAuthedQuery(isOrg ? "applications/org" : null, (t) => api.orgApplications(t));
  // `hours/org-queue`, NOT a new spelling: /verify-hours already reads this exact
  // data under that key with the same fetcher (verify-hours/page.tsx). `GET /hours`
  // branches on role, so the org queue and a student's own ledger are different
  // answers and correctly hold different keys — but there must not be a third.
  // Sharing it means this page's `verify()` and that page's decisions now see one
  // cache entry instead of two that drift.
  const hoursQ = useAuthedQuery(isOrg ? "hours/org-queue" : null, (t) => api.listHours(t));
  // Memoized because `activeOpps`/`historyOpps` below memo over `opps`; a fresh []
  // each render would make their deps change every time (the lint warning the
  // dashboard conversion hit).
  const opps = useMemo(() => oppsQ.data ?? [], [oppsQ.data]);
  const apps = useMemo(() => appsQ.data ?? [], [appsQ.data]);
  const hours = useMemo(() => hoursQ.data ?? [], [hoursQ.data]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Distinguishes a genuinely empty tab from a failed initial load (audit
  // finding 2026-08-25) — this page's old refresh() silently swallowed the
  // failure instead. Combined across the three queries, matching the pre-SWR
  // shape: one inline error covers every tab. Per-panel errors are now possible
  // and deliberately NOT done here.
  const loadError = Boolean(oppsQ.error || appsQ.error || hoursQ.error);
  // NEW: there was no loading flag at all before. Without one, a slow load
  // rendered "No listings yet." / "No applicants yet." before the fetch had
  // resolved — the flash-of-false-empty this milestone exists to remove.
  const loadPending = oppsQ.loading || appsQ.loading || hoursQ.loading;

  // Broadcast composer state.
  const [msgOpp, setMsgOpp] = useState<string>("");
  const [msgBody, setMsgBody] = useState("");
  const [msgAudience, setMsgAudience] = useState<Audience>("all");
  const [broadcasting, setBroadcasting] = useState(false);
  const [broadcastMsg, setBroadcastMsg] = useState<string | null>(null);

  // Profile form state.
  const [emailNotifs, setEmailNotifs] = useState(true);
  const [savedProfile, setSavedProfile] = useState(false);

  // Account section (export + delete).
  const [delConfirm, setDelConfirm] = useState("");
  const [delPassword, setDelPassword] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Re-read all three. Every caller is a WRITE that can move more than one of them:
  // approving an application changes the roster AND the listing's spots, and
  // verifying hours changes the queue AND the counts the Listings tab shows. Fanning
  // out to all three is what the old refresh() did and is still the honest answer.
  function refresh() {
    oppsQ.retry();
    appsQ.retry();
    hoursQ.retry();
  }

  // Only the profile form still needs an effect; the three loads are the queries'
  // own job now. Seeding a form field from `user` is not a fetch, so it does not
  // belong in a query.
  useEffect(() => {
    if (loading || !user) return;
    setEmailNotifs(user.email_notifications);
  }, [loading, user]);

  const now = new Date();
  const nowMs = now.getTime();
  const activeOpps = useMemo(() => opps.filter((o) => !isExpired(o, nowMs)), [opps, nowMs]);
  const historyOpps = useMemo(
    () => opps.filter((o) => isExpired(o, nowMs)).sort((a, b) => +new Date(b.end_time) - +new Date(a.end_time)),
    [opps, nowMs],
  );
  const pending = apps.filter((a) => a.status === "pending");

  // Month grid for the calendar tab.
  const gridStart = new Date(now.getFullYear(), now.getMonth(), 1);
  gridStart.setDate(1 - gridStart.getDay());
  const days = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    return d;
  });

  async function decide(id: string, action: "approve" | "reject") {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;
    setBusyId(id);
    setError(null);
    try {
      await api.decideApplication(id, action, token);
      refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setBusyId(null);
    }
  }

  async function verify(id: string, action: "approve" | "deny") {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;
    setBusyId(id);
    setError(null);
    try {
      await api.verifyHours(id, action, token);
      refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setBusyId(null);
    }
  }

  async function toggleFeature(o: Opportunity) {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;
    setBusyId(o.id);
    try {
      await api.setFeatured(o.id, !o.featured, token);
      refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update the listing.");
    } finally {
      setBusyId(null);
    }
  }

  // M11 item 8 (2026-09-25): account deletion 409s while any listing is active, and until
  // now nothing in the UI could deactivate one, so an org could not delete its account
  // in-app. Deactivating only hides a listing from discovery; its applications and logged
  // hours are untouched (`set_active` in routes/opportunities.py).
  async function toggleActive(o: Opportunity) {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;
    setBusyId(o.id);
    try {
      await api.setActive(o.id, !o.active, token);
      refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update the listing.");
    } finally {
      setBusyId(null);
    }
  }

  async function sendBroadcast() {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token || !msgOpp || !msgBody.trim()) return;
    setBroadcasting(true);
    setBroadcastMsg(null);
    try {
      const { sent } = await api.broadcast(msgOpp, msgBody.trim(), msgAudience, token);
      setBroadcastMsg(`Sent to ${sent} applicant${sent === 1 ? "" : "s"}.`);
      setMsgBody("");
    } catch (err) {
      setBroadcastMsg(err instanceof ApiError ? err.message : "Failed to send.");
    } finally {
      setBroadcasting(false);
    }
  }

  async function saveProfile() {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;
    try {
      await api.updateMe(token, { email_notifications: emailNotifs });
      setSavedProfile(true);
      setTimeout(() => setSavedProfile(false), 2500);
    } catch {
      /* non-fatal */
    }
  }

  function exportRoster() {
    const rows = [["Student", "Email", "Opportunity", "Date", "Hours", "Status"]];
    for (const h of hours)
      rows.push([h.student_name ?? "", h.student_email ?? "", h.opportunity.title, h.occurrence_date ?? "", String(h.hours), h.status]);
    const csv = toCsv(rows);
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "volunteer-roster.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function downloadExport() {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;
    setDeleteError(null);
    try {
      const data = await api.exportMe(token);
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = "citoya-data-export.json";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : "Could not export your data.");
    }
  }

  async function deleteAccount() {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await api.deleteMe(delPassword, token);
      logout();
      router.push("/");
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : "Could not delete your account.");
      setDeleting(false);
    }
  }

  if (loading) return null;
  if (!user || user.role !== "org") {
    return (
      <V1Shell>
        <div className="detail-wrap">
          <p style={{ color: "var(--muted)" }}>Only organization accounts have a dashboard.</p>
        </div>
      </V1Shell>
    );
  }

  const planLabel = user.plan === "pro" ? "Pro" : "Community";
  const maxActive = user.plan === "pro" ? "∞" : "3";

  // Mirrors dashboard/page.tsx's sectionError + hours/page.tsx's loadError panel.
  const loadErrorPanel = (
    <div className="load-error">
      <div className="empty-icon"><TriangleAlert size={40} strokeWidth={1.75} aria-hidden /></div>
      <div className="ferr">Couldn&apos;t load your data. Check your connection and try again.</div>
      <div>
        <button className="btn-s" style={{ padding: "9px 18px", fontSize: ".83rem" }} onClick={refresh}>
          Retry
        </button>
      </div>
    </div>
  );

  // Same skeleton as dashboard/page.tsx, so a slow tab shows "still loading"
  // rather than an empty state that reads as "you have nothing".
  const skelPanel = (
    <div className="skel-card" aria-busy="true">
      <div className="skel skel-line" style={{ width: "55%", height: 16, marginBottom: 14 }} />
      <div className="skel skel-line" style={{ width: "100%", marginBottom: 8 }} />
      <div className="skel skel-line" style={{ width: "92%", marginBottom: 8 }} />
      <div className="skel skel-line" style={{ width: "78%" }} />
    </div>
  );

  // Error wins over loading: a failed load must never look like a slow one.
  const panelState = loadError ? loadErrorPanel : loadPending ? skelPanel : null;

  function listingCard(o: Opportunity, inHistory: boolean) {
    const loc = (o.location || "").toLowerCase();
    const fmt = (o.format || "").toLowerCase();
    const meta = getCategoryMeta(o.category);
    const pip = fmt === "remote" || loc.includes("remote")
      ? <span className="format-pip remote"><Globe size={12} strokeWidth={1.75} aria-hidden />Remote</span>
      : fmt === "hybrid" || loc.includes("hybrid")
        ? <span className="format-pip hybrid"><Shuffle size={12} strokeWidth={1.75} aria-hidden />Hybrid</span>
        : <span className="format-pip inperson"><MapPin size={12} strokeWidth={1.75} aria-hidden />In-Person</span>;
    const appCount = apps.filter((a) => a.opportunity_id === o.id).length;
    return (
      <div key={o.id} className={`opp-card${o.featured ? " featured" : ""}`}>
        <div className="oc-top">
          <div className="oc-avatar" style={{ background: meta.bg, color: meta.fg }}><CategoryIcon category={o.category} size={20} /></div>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            {o.featured && <span className="badge badge-featured">★ Featured</span>}
            {/* M15.1: "Pending review" BEATS Active/Inactive, because a listing
                labelled "Active" that no student can see is a lie. Expired still
                beats pending — an expired listing is not waiting on anything. */}
            {inHistory
              ? <span className="badge badge-denied" style={{ opacity: 0.7 }}>Expired</span>
              : !user!.is_approved
                ? <span className="badge badge-pending">{user!.org_reviewed_at ? "Not approved" : "Pending review"}</span>
                : <span className={`badge ${o.active ? "badge-verified" : "badge-denied"}`}>{o.active ? "Active" : "Inactive"}</span>}
            {isRecurring(o) && <span className="badge badge-skill" style={{ fontSize: ".65rem" }}><RefreshCw size={12} strokeWidth={1.75} aria-hidden /> {o.recurrence === "weekly" ? "Weekly" : "Monthly"}</span>}
          </div>
        </div>
        <Link href={`/opportunities/${o.id}`} className="oc-title">{o.title}</Link>
        <div style={{ marginBottom: 6 }}>{pip}</div>
        <div className="oc-meta" style={{ marginTop: 4 }}>
          <span><CalendarDays size={13} strokeWidth={1.75} aria-hidden />{fmtEventDate(o.start_time, o.timezone)}</span>
          <span><Clock size={13} strokeWidth={1.75} aria-hidden />{o.duration_hours} hrs</span>
          <span><Users size={13} strokeWidth={1.75} aria-hidden />{o.spots_remaining}/{o.spots_available}</span>
        </div>
        <div className="oc-footer">
          <span style={{ fontSize: ".73rem", color: "var(--muted)" }}>{appCount} volunteers</span>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {!inHistory && (
              <>
                <button
                  className="btn-s"
                  style={{ padding: "6px 12px", fontSize: ".75rem" }}
                  onClick={() => { setTab("applicants"); setMsgOpp(o.id); }}
                ><MessageCircle size={14} strokeWidth={1.75} aria-hidden /> Message</button>
                {user!.plan === "pro" ? (
                  <button
                    className="btn-s"
                    style={{ padding: "6px 12px", fontSize: ".75rem", color: "#8a6d1d", borderColor: "var(--gold)" }}
                    disabled={busyId === o.id}
                    onClick={() => toggleFeature(o)}
                  >{o.featured ? "★ Unfeature" : "☆ Feature"}</button>
                ) : (
                  <Link className="btn-s" style={{ padding: "6px 12px", fontSize: ".75rem" }} href="/billing">Upgrade to feature</Link>
                )}
              </>
            )}
            {/* On history cards too: an expired listing that is still active blocks
                account deletion just the same. Reactivating an expired one is pointless,
                so history shows only Deactivate. */}
            {(!inHistory || o.active) && (
              <button
                className="btn-s"
                style={{ padding: "6px 12px", fontSize: ".75rem" }}
                disabled={busyId === o.id}
                onClick={() => toggleActive(o)}
              >{o.active ? "Deactivate" : "Reactivate"}</button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <V1Shell>
      <div className="dash-layout">
        {/* SIDEBAR */}
        <div>
          <div className="dash-sidebar">
            <div className="ds-avatar">{(user.full_name || "O").charAt(0).toUpperCase()}</div>
            <div className="ds-name">{user.full_name || "Organization"}</div>
            <div className="ds-role" style={{ color: "var(--muted)", fontSize: ".73rem", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 10 }}>Organization</div>
            <div className="plan-usage" style={{ marginBottom: 14 }}>
              {/* `—` not 0 while the load is failed: these sit in the sidebar on
                  every tab, including next to loadErrorPanel (landing-check 2026-09-01). */}
              <strong>{planLabel}</strong> plan · {loadError || loadPending ? "—" : activeOpps.filter((o) => o.active).length}/{maxActive} active listings
              {/* Same reason as the badge: "2/3 active listings" is not true of an
                  org whose listings are not visible to anyone yet. */}
              {!user.is_approved && <span style={{ color: "var(--muted)" }}> ({user.org_reviewed_at ? "not approved" : "pending review"})</span>}
              {user.plan !== "pro" && <><br /><Link href="/billing" style={{ color: "var(--green)" }}>Upgrade to Pro →</Link></>}
            </div>
            <hr className="ds-divider" />
            <div className="ds-stat"><span className="ds-stat-label">Active Listings</span><span className="ds-stat-val big">{loadError || loadPending ? "—" : activeOpps.filter((o) => o.active).length}</span></div>
            <div className="ds-stat"><span className="ds-stat-label">Total Volunteers</span><span className="ds-stat-val">{loadError || loadPending ? "—" : apps.length}</span></div>
            <div className="ds-stat"><span className="ds-stat-label">Pending Approvals</span><span className="ds-stat-val">{loadError || loadPending ? "—" : pending.length}</span></div>
            <hr className="ds-divider" />
            <div className="ds-nav">
              {TABS.map((t) => (
                <button key={t.id} className={`ds-link${tab === t.id ? " on" : ""}`} onClick={() => setTab(t.id)}><t.Icon size={15} strokeWidth={1.75} aria-hidden />{t.label}</button>
              ))}
              <button className="ds-link" onClick={logout}><LogOut size={15} strokeWidth={1.75} aria-hidden />Log Out</button>
            </div>
          </div>
        </div>

        {/* MAIN */}
        <div className="dash-main">
          {/* Above every tab, not just My Listings: an org sitting on the Applicants
              tab wondering where its volunteers are needs the same answer. */}
          <OrgReviewBanner />
          {error && <div className="ferr" style={{ display: "block" }}>{error}</div>}

          {tab === "listings" && (
            <div className="tab-panel on">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
                <h1 className="dash-h" style={{ marginBottom: 0 }}>My Listings</h1>
                <Link className="btn-p" style={{ padding: "10px 20px", fontSize: ".85rem" }} href="/opportunities/new">＋ Add Listing</Link>
              </div>
              <div className="cards-grid">
                {panelState ?? (activeOpps.length ? activeOpps.map((o) => listingCard(o, false)) : (
                  <div className="empty"><div className="empty-icon"><ClipboardList size={40} strokeWidth={1.75} aria-hidden /></div>No listings yet. Hit ＋ Add Listing to post your first.</div>
                ))}
              </div>
            </div>
          )}

          {tab === "analytics" && (
            <div className="tab-panel on">
              <h1 className="dash-h" style={{ marginBottom: 6 }}>Analytics</h1>
              <p style={{ fontSize: ".83rem", color: "var(--muted)", fontWeight: 300, marginBottom: 18 }}>Detail views, approved signups and verified hours for each of your listings.</p>
              {/* M14.2. Backed by GET /analytics/org, scoped in SQL to this org.
                  Until 2026-09-03 these numbers were derived client-side and two of
                  the three were wrong: "Applicants" counted rejected and withdrawn
                  rows, and "Spots filled" used `spots_available - spots_remaining`,
                  which the backend only maintains for ONE-TIME listings — so every
                  recurring listing showed a fabricated figure. Fill rate is now shown
                  only where it is meaningful.
                  Counts only: no viewer identity exists to report, so nothing here
                  may be labelled "visitors" (app/privacy/page.tsx). */}
              {orgStatsError ? (
                <div className="load-error">
                  <div className="empty-icon"><TriangleAlert size={40} strokeWidth={1.75} aria-hidden /></div>
                  <div className="ferr">Couldn&apos;t load your analytics. Check your connection and try again.</div>
                  <div><button className="btn-s" style={{ padding: "9px 18px", fontSize: ".83rem" }} onClick={retryOrgStats}>Retry</button></div>
                </div>
              ) : orgStatsLoading || !orgStats ? (
                /* `!orgStats` matters: the hook can be neither loading nor errored
                   with data still undefined, and that instant must show the skeleton,
                   never the "post a listing" empty copy. */
                <div className="skel-card" aria-busy="true">
                  <div className="skel skel-line" style={{ width: "55%", height: 16, marginBottom: 14 }} />
                  <div className="skel skel-line" style={{ width: "100%", marginBottom: 8 }} />
                  <div className="skel skel-line" style={{ width: "92%" }} />
                </div>
              ) : orgStats.listing_count === 0 ? (
                <div className="empty"><div className="empty-icon"><TrendingUp size={40} strokeWidth={1.75} aria-hidden /></div>Post a listing to start collecting analytics.</div>
              ) : (
                <>
                  <div className="lb-band" style={{ marginBottom: 18 }}>
                    <div className="lb-stat"><div className="lb-stat-num traffic-num">{orgStats.total_views.toLocaleString()}</div><div className="lb-stat-label">Detail Views</div></div>
                    <div className="lb-stat"><div className="lb-stat-num traffic-num">{orgStats.total_approved.toLocaleString()}</div><div className="lb-stat-label">Approved Signups</div></div>
                    <div className="lb-stat"><div className="lb-stat-num traffic-num">{orgStats.total_verified_hours.toLocaleString()}</div><div className="lb-stat-label">Verified Hours</div></div>
                    <div className="lb-stat"><div className="lb-stat-num traffic-num">{orgStats.returning_volunteers.toLocaleString()}</div><div className="lb-stat-label">Returning Volunteers</div></div>
                  </div>
                  <table className="tbl">
                    <caption className="sr-only">Per-listing detail views, approved signups, fill rate and verified hours</caption>
                    <thead>
                      <tr>
                        <th scope="col">Listing</th>
                        <th scope="col" style={{ textAlign: "right" }}>Views</th>
                        <th scope="col" style={{ textAlign: "right" }}>Approved</th>
                        <th scope="col">Fill rate</th>
                        <th scope="col" style={{ textAlign: "right" }}>Verified hrs</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orgStats.listings.map((row) => {
                        // A whole-listing percentage is only honest for a one-time
                        // event. On a recurring listing `spots_available` is per DATE,
                        // so approved-over-spots can exceed 100% and mean nothing.
                        const pct = row.recurrence === "one_time" && row.spots_available > 0
                          ? Math.min(100, Math.round((row.approved / row.spots_available) * 100))
                          : null;
                        return (
                          <tr key={row.id}>
                            <td><strong>{row.title}</strong>{row.active ? "" : " (inactive)"}</td>
                            <td className="traffic-num" style={{ textAlign: "right" }}>{row.views.toLocaleString()}</td>
                            <td className="traffic-num" style={{ textAlign: "right" }}>{row.approved.toLocaleString()}</td>
                            <td>
                              {pct === null ? (
                                <span style={{ fontSize: ".78rem", color: "var(--muted)" }}>Per-date &mdash; see listing</span>
                              ) : (
                                <>
                                  <div className="progress-bar"><div className="progress-fill" style={{ width: `${pct}%` }} /></div>
                                  <div className="progress-label">{row.approved}/{row.spots_available} spots ({pct}%)</div>
                                </>
                              )}
                            </td>
                            <td className="traffic-num" style={{ textAlign: "right" }}>{row.verified_hours.toLocaleString()}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </>
              )}
              <div style={{ marginTop: 16, padding: "14px 16px", background: "var(--gold-pale, #fdf7e3)", border: "1px solid var(--gold)", borderRadius: 8, fontSize: ".83rem", color: "var(--dark)" }}>
                <Star size={14} strokeWidth={1.75} aria-hidden /> <strong>Pro adds:</strong> unlimited listings and featured placement at the top of search.
              </div>
            </div>
          )}

          {tab === "calendar" && (
            <div className="tab-panel on">
              <h1 className="dash-h">Events Calendar</h1>
              {panelState}
              <div className="cal-wrap">
                <div className="cal-hdr"><span className="cal-title">{now.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</span></div>
                <div className="cal-grid">
                  {DOW.map((d) => <div key={d} className="cal-day-head">{d}</div>)}
                  {days.map((d, i) => {
                    const otherMonth = d.getMonth() !== now.getMonth();
                    const isToday = d.toDateString() === now.toDateString();
                    const evs = activeOpps.filter((o) => eventDateKey(o.start_time, o.timezone) === localDateKey(d));
                    return (
                      <div key={i} className={`cal-day${otherMonth ? " other-month" : ""}${isToday ? " today" : ""}`}>
                        <div className="cal-date">{d.getDate()}</div>
                        {evs.map((o) => <div key={o.id} className="cal-event" title={o.title}>{o.title}</div>)}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {tab === "applicants" && (
            <div className="tab-panel on">
              <h1 className="dash-h">Volunteer Applicants</h1>

              {/* Broadcast composer (v2 messaging) */}
              <div className="form-box" style={{ marginBottom: 18 }}>
                <div className="fr">
                  <label htmlFor="applicants-broadcast-opportunity">Message a listing’s applicants</label>
                  <select id="applicants-broadcast-opportunity" className="fc" value={msgOpp} onChange={(e) => setMsgOpp(e.target.value)}>
                    <option value="">Select a listing…</option>
                    {activeOpps.map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}
                  </select>
                </div>
                <div className="fr">
                  <textarea className="fc" style={{ minHeight: 70 }} value={msgBody} onChange={(e) => setMsgBody(e.target.value)} placeholder="Send an update to your volunteers…" />
                </div>
                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <select className="fc" style={{ width: "auto" }} value={msgAudience} onChange={(e) => setMsgAudience(e.target.value as Audience)}>
                    <option value="all">All applicants</option>
                    <option value="approved">Approved only</option>
                    <option value="pending">Pending only</option>
                  </select>
                  <button className="fsubmit" style={{ marginTop: 0 }} disabled={broadcasting || !msgOpp || !msgBody.trim()} onClick={sendBroadcast}>{broadcasting ? "Sending…" : "Send"}</button>
                  {broadcastMsg && <span style={{ fontSize: ".82rem", color: "var(--muted)" }}>{broadcastMsg}</span>}
                </div>
              </div>

              {panelState ?? (apps.length ? (
                <table className="tbl">
                  <thead><tr><th>Student</th><th>Opportunity</th><th>Status</th><th>Applied</th><th></th></tr></thead>
                  <tbody>
                    {apps.map((a) => (
                      <tr key={a.id}>
                        <td>
                          <StudentCell name={a.student_name} email={a.student_email} inactive={a.student_inactive} />
                        </td>
                        <td style={{ fontSize: ".83rem" }}><strong>{a.opportunity.title}</strong></td>
                        <td><span className={`status-pill sp-${a.status}`}>{a.status}</span></td>
                        <td style={{ fontSize: ".78rem", color: "var(--muted)" }}>{fmtDate(a.created_at)}</td>
                        <td>{a.status === "pending" && (
                          <div style={{ display: "flex", gap: 6 }}>
                            <button className="btn-approve" disabled={busyId === a.id} onClick={() => decide(a.id, "approve")}>✓</button>
                            <button className="btn-reject" disabled={busyId === a.id} onClick={() => decide(a.id, "reject")}>✕</button>
                          </div>
                        )}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="empty"><div className="empty-icon"><Users size={40} strokeWidth={1.75} aria-hidden /></div>No applicants yet.</div>
              ))}
            </div>
          )}

          {tab === "hours" && (
            <div className="tab-panel on">
              <h1 className="dash-h" style={{ marginBottom: 6 }}>Verify Hours</h1>
              <p style={{ fontSize: ".83rem", color: "var(--muted)", fontWeight: 300, marginBottom: 14 }}>Review and approve or deny volunteer hour requests.</p>
              <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
                <button className="btn-s" style={{ padding: "9px 18px", fontSize: ".82rem" }} onClick={exportRoster}><Download size={15} strokeWidth={1.75} aria-hidden /> Export Volunteer Roster (CSV)</button>
              </div>
              {panelState ?? (hours.length ? (
                <table className="tbl">
                  <thead><tr><th>Student</th><th>Opportunity</th><th>Date</th><th>Hours</th><th>Status</th><th></th></tr></thead>
                  <tbody>
                    {hours.map((h) => (
                      <tr key={h.id}>
                        <td>
                          <StudentCell name={h.student_name} email={h.student_email} inactive={h.student_inactive} />
                        </td>
                        <td style={{ fontSize: ".83rem" }}><strong>{h.opportunity.title}</strong></td>
                        <td style={{ fontSize: ".78rem" }}>{h.occurrence_date ? fmtDateKey(h.occurrence_date) : "—"}</td>
                        <td><strong>{h.hours}</strong></td>
                        <td><span className={`status-pill sp-${h.status}`}>{h.status}</span></td>
                        <td>{(h.status === "pending" || h.status === "appealed") && (
                          <div style={{ display: "flex", gap: 6 }}>
                            <button className="btn-approve" disabled={busyId === h.id} onClick={() => verify(h.id, "approve")}>✓ Verify</button>
                            <button className="btn-reject" disabled={busyId === h.id} onClick={() => verify(h.id, "deny")}>✕ Deny</button>
                          </div>
                        )}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="empty"><div className="empty-icon"><BadgeCheck size={40} strokeWidth={1.75} aria-hidden /></div>No pending hour requests.</div>
              ))}
            </div>
          )}

          {tab === "history" && (
            <div className="tab-panel on">
              <h1 className="dash-h" style={{ marginBottom: 6 }}>Listing History</h1>
              <p style={{ fontSize: ".83rem", color: "var(--muted)", fontWeight: 300, marginBottom: 18 }}>One-time listings whose end date has passed. Recurring listings always stay in My Listings.</p>
              <div className="cards-grid">
                {panelState ?? (historyOpps.length ? historyOpps.map((o) => listingCard(o, true)) : (
                  <div className="empty"><div className="empty-icon"><Archive size={40} strokeWidth={1.75} aria-hidden /></div>No expired listings yet.</div>
                ))}
              </div>
            </div>
          )}

          {tab === "profile" && (
            <div className="tab-panel on">
              <h1 className="dash-h">Organization Profile</h1>
              <div className="form-box" style={{ maxWidth: 580 }}>
                {/* Disabled because nothing saves it. `saveProfile` sends only
                    email_notifications and `api.updateMe` accepts only
                    email_notifications/portfolio_public — so an org could edit this,
                    press Save Changes, see "Saved ✓" and lose the value silently
                    (audit 2026-08-06). Re-enable when a backend field exists. */}
                <div className="fr">
                  <label htmlFor="applicants-org-name">Organization Name</label>
                  <input id="applicants-org-name" className="fc" defaultValue={user.full_name || ""} disabled />
                  <div className="fhint">Contact support to change your organization name.</div>
                </div>
                <div className="fr"><label htmlFor="applicants-org-email">Email</label><input id="applicants-org-email" className="fc" defaultValue={user.email} disabled /></div>
                <div className="fr">
                  <label style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>
                    <input type="checkbox" checked={emailNotifs} onChange={(e) => setEmailNotifs(e.target.checked)} style={{ width: 15, height: 15, accentColor: "var(--green)" }} />
                    Email me when I get a notification
                  </label>
                </div>
                <button className="fsubmit" onClick={saveProfile}>Save Changes</button>
                {savedProfile && <span style={{ marginLeft: 12, fontSize: ".82rem", color: "var(--green)" }}>Saved ✓</span>}
                <div style={{ marginTop: 20, paddingTop: 20, borderTop: "1px solid var(--border)", display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <Link className="btn-s" style={{ padding: "9px 18px", fontSize: ".83rem" }} href="/billing">Manage Billing</Link>
                  <button className="btn-s" style={{ padding: "9px 18px", fontSize: ".83rem" }} onClick={downloadExport}><Download size={15} strokeWidth={1.75} aria-hidden /> Download my data (JSON)</button>
                </div>
                <div className="delete-zone" style={{ maxWidth: 580 }}>
                  <h4><TriangleAlert size={16} strokeWidth={1.75} aria-hidden /> Delete Account</h4>
                  <p>
                    Your past listings and the hours you verified are kept so your volunteers’ records stay intact.
                    Your account (profile, login, messages you sent, and notifications) is permanently erased.
                    You must deactivate all active listings first (the Deactivate button on each card in My Listings and Listing History). <strong>This cannot be undone.</strong>
                  </p>
                  <div className="fr">
                    <label htmlFor="applicants-delete-confirm">Type DELETE to confirm</label>
                    <input id="applicants-delete-confirm" className="fc" value={delConfirm} onChange={(e) => setDelConfirm(e.target.value)} placeholder="DELETE" />
                  </div>
                  <div className="fr">
                    <label htmlFor="applicants-delete-password">Current password</label>
                    <input id="applicants-delete-password" className="fc" type="password" value={delPassword} onChange={(e) => setDelPassword(e.target.value)} />
                  </div>
                  {deleteError && <div className="ferr" style={{ display: "block" }}>{deleteError}</div>}
                  <button
                    className="btn-s"
                    style={{ color: "var(--red)", borderColor: "var(--red)", padding: "9px 18px", fontSize: ".83rem" }}
                    disabled={delConfirm !== "DELETE" || !delPassword || deleting}
                    onClick={deleteAccount}
                  >{deleting ? "Deleting…" : "Delete Organization Account"}</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </V1Shell>
  );
}

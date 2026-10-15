"use client";

import { errorText } from "@/lib/errors";
import { Archive, BadgeCheck, CalendarDays, Check, ClipboardList, Clock, Download, Globe, Landmark, LogOut, MapPin, MessageCircle, RefreshCw, Shuffle, Star, TrendingUp, TriangleAlert, Users, X, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useEffect, useMemo, useState } from "react";

import { CategoryIcon, getCategoryMeta } from "@/components/v1/category-icon";
import { OrgReviewBanner } from "@/components/org-review-banner";
import { StudentCell } from "@/components/student-cell";
import { V1Shell } from "@/components/v1/v1-shell";
import { api } from "@/lib/api";
import { useAuthedQuery } from "@/lib/use-api";
import { TOKEN_KEY, useAuth } from "@/lib/auth-context";
import { toCsv } from "@/lib/csv";
import { eventDateKey, fmtDateKey, fmtEventDate, localDateKey } from "@/lib/event-time";
import { hoursTitle } from "@/lib/hours";
import type { Opportunity } from "@/lib/types";

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type Tab = "listings" | "analytics" | "calendar" | "applicants" | "hours" | "history" | "profile";
type Audience = "all" | "approved" | "pending";

const TABS: { id: Tab; label: string; Icon: LucideIcon }[] = [
  { id: "listings", label: "My listings", Icon: ClipboardList },
  { id: "analytics", label: "Analytics", Icon: TrendingUp },
  { id: "calendar", label: "Calendar", Icon: CalendarDays },
  { id: "applicants", label: "Applicants", Icon: Users },
  { id: "hours", label: "Verify hours", Icon: BadgeCheck },
  { id: "history", label: "Listing history", Icon: Archive },
  { id: "profile", label: "Org profile", Icon: Landmark },
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
  // GET /applications/org and the org side of GET /hours answer 403 until an admin approves
  // the org (decision 3A, 2026-10-09), so those two stay held for an unapproved or rejected
  // org: the OrgReviewBanner explains why, and no error block appears for the lists.
  const isApprovedOrg = isOrg && user?.is_approved === true;
  const {
    data: orgStats,
    error: orgStatsError,
    loading: orgStatsLoading,
    retry: retryOrgStats,
  } = useAuthedQuery(isOrg ? "analytics/org" : null, (t) => api.orgAnalytics(t));
  const oppsQ = useAuthedQuery(isOrg ? "opportunities/mine" : null, (t) => api.myOpportunities(t));
  const appsQ = useAuthedQuery(isApprovedOrg ? "applications/org" : null, (t) => api.orgApplications(t));
  // `hours/org-queue`, NOT a new spelling: /verify-hours already reads this exact
  // data under that key with the same fetcher (verify-hours/page.tsx). `GET /hours`
  // branches on role, so the org queue and a student's own ledger are different
  // answers and correctly hold different keys — but there must not be a third.
  // Sharing it means this page's `verify()` and that page's decisions now see one
  // cache entry instead of two that drift.
  const hoursQ = useAuthedQuery(isApprovedOrg ? "hours/org-queue" : null, (t) => api.listHours(t));
  // Skill endorsements (PRD M17.3, 2026-10-09): the skill list is the listing's own, so an
  // org writes no free text about a student. `given` greys out skills already endorsed.
  const { data: givenData, mutate: mutateGiven } = useAuthedQuery(isApprovedOrg ? "endorsements/given" : null, (t) =>
    api.givenEndorsements(t),
  );
  const endorsedKeys = useMemo(() => new Set((givenData ?? []).map((e) => `${e.student_id}|${e.skill}`)), [givenData]);
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
  const [profileError, setProfileError] = useState<string | null>(null);

  // Account section (export + delete).
  const [delConfirm, setDelConfirm] = useState("");
  const [delPassword, setDelPassword] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Deny is two steps here too, as on /verify-hours (2026-10-08, the named gap from audit DY Low 33).
  const [denyingId, setDenyingId] = useState<string | null>(null);
  const [denyNote, setDenyNote] = useState("");

  // Endorse controls, keyed by hours id: the picked skill and the "Endorsed: ..." line.
  const [endorsePick, setEndorsePick] = useState<Record<string, string>>({});
  const [endorsedNote, setEndorsedNote] = useState<Record<string, string>>({});

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
      setError(errorText(err, "We could not save your decision. Check your connection and try again."));
    } finally {
      setBusyId(null);
    }
  }

  async function endorse(hoursId: string, studentId: string, skill: string) {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;
    setBusyId(hoursId);
    setError(null);
    try {
      await api.endorse(studentId, skill, token);
      setEndorsedNote((m) => ({ ...m, [hoursId]: skill }));
      void mutateGiven();
    } catch (err) {
      setError(errorText(err, "We could not save that endorsement. Check your connection and try again."));
    } finally {
      setBusyId(null);
    }
  }

  async function verify(id: string, action: "approve" | "deny", note?: string) {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;
    setBusyId(id);
    setError(null);
    try {
      await api.verifyHours(id, action, token, note);
      setDenyingId(null);
      setDenyNote("");
      refresh();
    } catch (err) {
      setError(errorText(err, "We could not verify those hours. Check your connection and try again."));
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
      setError(errorText(err, "Could not update the listing."));
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
      setError(errorText(err, "Could not update the listing."));
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
      setBroadcastMsg(errorText(err, "Failed to send."));
    } finally {
      setBroadcasting(false);
    }
  }

  async function saveProfile() {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;
    setProfileError(null);
    try {
      await api.updateMe(token, { email_notifications: emailNotifs });
      setSavedProfile(true);
      setTimeout(() => setSavedProfile(false), 2500);
    } catch (err) {
      // audit DY Low 42, 2026-10-07: this was swallowed, so a failed save looked like
      // nothing had been clicked and the org kept believing the preference was stored.
      setProfileError(errorText(err, "Could not save your changes."));
    }
  }

  function exportRoster() {
    const rows = [["Student", "Email", "Opportunity", "Date", "Hours", "Status"]];
    for (const h of hours)
      rows.push([h.student_name ?? "", h.student_email ?? "", hoursTitle(h), h.occurrence_date ?? "", String(h.hours), h.status]);
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
      setDeleteError(errorText(err, "Could not export your data."));
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
      // Recoverable for 48 hours (2026-09-26): the login page says so, and a login
      // there offers the restore.
      router.push("/login?deleted=1");
    } catch (err) {
      setDeleteError(errorText(err, "Could not delete your account."));
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
      <div className="ferr" role="alert">Could not load your data. Check your connection and try again.</div>
      <div>
        <button className="btn-s btn-sm" onClick={refresh}>
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
        : <span className="format-pip inperson"><MapPin size={12} strokeWidth={1.75} aria-hidden />In-person</span>;
    const appCount = apps.filter((a) => a.opportunity_id === o.id).length;
    return (
      <div key={o.id} className={`opp-card${o.featured ? " featured" : ""}`}>
        <div className="oc-top">
          <div className="oc-avatar" style={{ background: meta.bg, color: meta.fg }}><CategoryIcon category={o.category} size={20} /></div>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            {o.featured && <span className="badge badge-featured"><Star size={16} strokeWidth={1.75} aria-hidden /> Featured</span>}
            {/* M15.1: "Pending review" BEATS Active/Inactive, because a listing
                labelled "Active" that no student can see is a lie. Expired still
                beats pending — an expired listing is not waiting on anything. */}
            {inHistory
              ? <span className="badge badge-denied" style={{ opacity: 0.7 }}>Expired</span>
              : !user!.is_approved
                ? <span className="badge badge-pending">{user!.org_reviewed_at ? "Not approved" : "Pending review"}</span>
                : <span className={`badge ${o.active ? "badge-verified" : "badge-denied"}`}>{o.active ? "Active" : "Inactive"}</span>}
            {isRecurring(o) && <span className="badge badge-skill" style={{ fontSize: "var(--fs-micro)" }}><RefreshCw size={12} strokeWidth={1.75} aria-hidden /> {o.recurrence === "weekly" ? "Weekly" : "Monthly"}</span>}
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
          <span style={{ fontSize: "var(--fs-micro)", color: "var(--muted)" }}>{appCount} volunteers</span>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {!inHistory && (
              <>
                <button
                  className="btn-s"
                  style={{ padding: "6px 12px", fontSize: "var(--fs-micro)" }}
                  onClick={() => { setTab("applicants"); setMsgOpp(o.id); }}
                ><MessageCircle size={14} strokeWidth={1.75} aria-hidden /> Message</button>
                {user!.plan === "pro" ? (
                  <button
                    className="btn-s"
                    style={{ padding: "6px 12px", fontSize: "var(--fs-micro)", color: "var(--c-gold-dark)", borderColor: "var(--gold)" }}
                    disabled={busyId === o.id}
                    onClick={() => toggleFeature(o)}
                  ><Star size={16} strokeWidth={1.75} aria-hidden fill={o.featured ? "currentColor" : "none"} /> {o.featured ? "Unfeature" : "Feature"}</button>
                ) : (
                  <Link className="btn-s" style={{ padding: "6px 12px", fontSize: "var(--fs-micro)" }} href="/billing">Upgrade to feature</Link>
                )}
              </>
            )}
            {/* On history cards too: an expired listing that is still active blocks
                account deletion just the same. Reactivating an expired one is pointless,
                so history shows only Deactivate. */}
            {(!inHistory || o.active) && (
              <button
                className="btn-s"
                style={{ padding: "6px 12px", fontSize: "var(--fs-micro)" }}
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
            <div className="ds-role" style={{ color: "var(--muted)", fontSize: "var(--fs-micro)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 10 }}>Organization</div>
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
            <div className="ds-stat"><span className="ds-stat-label">Active listings</span><span className="ds-stat-val big">{loadError || loadPending ? "—" : activeOpps.filter((o) => o.active).length}</span></div>
            <div className="ds-stat"><span className="ds-stat-label">Total volunteers</span><span className="ds-stat-val">{loadError || loadPending ? "—" : apps.length}</span></div>
            <div className="ds-stat"><span className="ds-stat-label">Pending approvals</span><span className="ds-stat-val">{loadError || loadPending ? "—" : pending.length}</span></div>
            <hr className="ds-divider" />
            <div className="ds-nav">
              {TABS.map((t) => (
                <button key={t.id} className={`ds-link${tab === t.id ? " on" : ""}`} onClick={() => setTab(t.id)}><t.Icon size={15} strokeWidth={1.75} aria-hidden />{t.label}</button>
              ))}
              <Link className="ds-link" href="/logout"><LogOut size={15} strokeWidth={1.75} aria-hidden />Log out</Link>
            </div>
          </div>
        </div>

        {/* MAIN */}
        <div className="dash-main">
          {/* Above every tab, not just My Listings: an org sitting on the Applicants
              tab wondering where its volunteers are needs the same answer. */}
          <OrgReviewBanner />
          {error && <div className="ferr" role="alert" style={{ display: "block" }}>{error}</div>}

          {tab === "listings" && (
            <div className="tab-panel on">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
                <h1 className="dash-h" style={{ marginBottom: 0 }}>My listings</h1>
                <Link className="btn-p" style={{ padding: "10px 20px", fontSize: "var(--fs-sm)" }} href="/opportunities/new">＋ Add listing</Link>
              </div>
              <div className="cards-grid">
                {panelState ?? (activeOpps.length ? activeOpps.map((o) => listingCard(o, false)) : (
                  <div className="empty"><div className="empty-icon"><ClipboardList size={40} strokeWidth={1.75} aria-hidden /></div>No listings yet. Hit ＋ Add listing to post your first.</div>
                ))}
              </div>
            </div>
          )}

          {tab === "analytics" && (
            <div className="tab-panel on">
              <h1 className="dash-h" style={{ marginBottom: 6 }}>Analytics</h1>
              <p style={{ fontSize: "var(--fs-label)", color: "var(--muted)", fontWeight: 400, marginBottom: 18 }}>Detail views, approved signups and verified hours for each of your listings.</p>
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
                  <div className="ferr" role="alert">Could not load your analytics. Check your connection and try again.</div>
                  <div><button className="btn-s btn-sm" onClick={retryOrgStats}>Retry</button></div>
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
                    <div className="lb-stat"><div className="lb-stat-num traffic-num">{orgStats.total_views.toLocaleString()}</div><div className="lb-stat-label">Detail views</div></div>
                    <div className="lb-stat"><div className="lb-stat-num traffic-num">{orgStats.total_approved.toLocaleString()}</div><div className="lb-stat-label">Approved signups</div></div>
                    <div className="lb-stat"><div className="lb-stat-num traffic-num">{orgStats.total_verified_hours.toLocaleString()}</div><div className="lb-stat-label">Verified hours</div></div>
                    <div className="lb-stat"><div className="lb-stat-num traffic-num">{orgStats.returning_volunteers.toLocaleString()}</div><div className="lb-stat-label">Returning volunteers</div></div>
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
                                <span style={{ fontSize: "var(--fs-micro)", color: "var(--muted)" }}>Per-date &mdash; see listing</span>
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
              <div style={{ marginTop: 16, padding: "14px 16px", background: "var(--gold-pale, var(--c-gold-pale-fallback))", border: "1px solid var(--gold)", borderRadius: 6, fontSize: "var(--fs-label)", color: "var(--dark)" }}>
                <Star size={14} strokeWidth={1.75} aria-hidden /> <strong>Pro adds:</strong> unlimited listings and featured placement at the top of search.
              </div>
            </div>
          )}

          {tab === "calendar" && (
            <div className="tab-panel on">
              <h1 className="dash-h">Events calendar</h1>
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
              <h1 className="dash-h">Volunteer applicants</h1>

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
                  <textarea className="fc" aria-label="Message to send" style={{ minHeight: 70 }} value={msgBody} onChange={(e) => setMsgBody(e.target.value)} placeholder="Send an update to your volunteers…" />
                </div>
                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <select className="fc" aria-label="Who receives this message" style={{ width: "auto" }} value={msgAudience} onChange={(e) => setMsgAudience(e.target.value as Audience)}>
                    <option value="all">All applicants</option>
                    <option value="approved">Approved only</option>
                    <option value="pending">Pending only</option>
                  </select>
                  <button className="fsubmit" style={{ marginTop: 0 }} disabled={broadcasting || !msgOpp || !msgBody.trim()} onClick={sendBroadcast}>{broadcasting ? "Sending…" : "Send"}</button>
                  {broadcastMsg && <span style={{ fontSize: "var(--fs-label)", color: "var(--muted)" }}>{broadcastMsg}</span>}
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
                        <td style={{ fontSize: "var(--fs-label)" }}><strong>{a.opportunity.title}</strong></td>
                        <td><span className={`status-pill sp-${a.status}`}>{a.status}</span></td>
                        <td style={{ fontSize: "var(--fs-micro)", color: "var(--muted)" }}>{fmtDate(a.created_at)}</td>
                        <td>{a.status === "pending" && (
                          <div style={{ display: "flex", gap: 6 }}>
                            <button className="btn-approve" disabled={busyId === a.id} onClick={() => decide(a.id, "approve")} aria-label="Approve"><Check size={16} strokeWidth={1.75} aria-hidden /></button>
                            <button className="btn-reject" disabled={busyId === a.id} onClick={() => decide(a.id, "reject")} aria-label="Reject"><X size={16} strokeWidth={1.75} aria-hidden /></button>
                          </div>
                        )}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="empty"><div className="empty-icon"><Users size={40} strokeWidth={1.75} aria-hidden /></div>No applicants yet. Students appear here once they apply to a listing.</div>
              ))}
            </div>
          )}

          {tab === "hours" && (
            <div className="tab-panel on">
              <h1 className="dash-h" style={{ marginBottom: 6 }}>Verify hours</h1>
              <p style={{ fontSize: "var(--fs-label)", color: "var(--muted)", fontWeight: 400, marginBottom: 14 }}>Review and approve or deny volunteer hour requests.</p>
              <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
                <button className="btn-s btn-sm" onClick={exportRoster}><Download size={15} strokeWidth={1.75} aria-hidden /> Export volunteer roster (CSV)</button>
              </div>
              {panelState ?? (hours.length ? (
                <table className="tbl">
                  <thead><tr><th>Student</th><th>Opportunity</th><th>Date</th><th>Hours</th><th>Status</th><th></th></tr></thead>
                  <tbody>
                    {hours.map((h) => (
                      <Fragment key={h.id}>
                      <tr>
                        <td>
                          <StudentCell name={h.student_name} email={h.student_email} inactive={h.student_inactive} />
                        </td>
                        <td style={{ fontSize: "var(--fs-label)" }}><strong>{hoursTitle(h)}</strong></td>
                        <td style={{ fontSize: "var(--fs-micro)" }}>{h.occurrence_date ? fmtDateKey(h.occurrence_date) : "—"}</td>
                        <td><strong>{h.hours}</strong></td>
                        <td><span className={`status-pill sp-${h.status}`}>{h.status}</span></td>
                        <td>{(h.status === "pending" || h.status === "appealed") && (
                          <div style={{ display: "flex", gap: 6 }}>
                            <button className="btn-approve" disabled={busyId === h.id} onClick={() => verify(h.id, "approve")}><Check size={16} strokeWidth={1.75} aria-hidden /> Verify</button>
                            <button className="btn-reject" disabled={busyId === h.id || denyingId === h.id} onClick={() => { setDenyingId(h.id); setDenyNote(""); }}><X size={16} strokeWidth={1.75} aria-hidden /> Deny</button>
                          </div>
                        )}
                        {h.status === "verified" && h.opportunity && h.opportunity.skills.length > 0 && (() => {
                          const skills = h.opportunity.skills;
                          const open = skills.filter((sk) => !endorsedKeys.has(`${h.user_id}|${sk}`));
                          const pick = endorsePick[h.id] && open.includes(endorsePick[h.id]) ? endorsePick[h.id] : (open[0] ?? skills[0]);
                          return (
                            <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                              <select
                                className="fc"
                                aria-label={`Skill to endorse for ${h.student_name ?? "this student"}`}
                                value={pick}
                                onChange={(e) => setEndorsePick((m) => ({ ...m, [h.id]: e.target.value }))}
                                style={{ width: "auto" }}
                              >
                                {skills.map((sk) => (
                                  <option key={sk} value={sk} disabled={endorsedKeys.has(`${h.user_id}|${sk}`)}>{sk}</option>
                                ))}
                              </select>
                              <button
                                className="btn-s"
                                disabled={busyId === h.id || open.length === 0}
                                onClick={() => endorse(h.id, h.user_id, pick)}
                              >
                                Endorse
                              </button>
                              {endorsedNote[h.id] && <span style={{ fontSize: "var(--fs-micro)", color: "var(--muted)" }}>Endorsed: {endorsedNote[h.id]}</span>}
                            </div>
                          );
                        })()}</td>
                      </tr>
                      {denyingId === h.id && (
                        <tr>
                          <td colSpan={6}>
                            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                              <input
                                className="fc"
                                aria-label="Reason for denying (optional)"
                                placeholder="Reason (optional, the student sees it)"
                                maxLength={500}
                                value={denyNote}
                                onChange={(e) => setDenyNote(e.target.value)}
                                style={{ flex: 1, minWidth: 200 }}
                              />
                              <button className="btn-reject" disabled={busyId === h.id} onClick={() => verify(h.id, "deny", denyNote.trim() || undefined)}>Confirm deny</button>
                              <button className="btn-s" disabled={busyId === h.id} onClick={() => setDenyingId(null)}>Cancel</button>
                            </div>
                          </td>
                        </tr>
                      )}
                      </Fragment>
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
              <h1 className="dash-h" style={{ marginBottom: 6 }}>Listing history</h1>
              <p style={{ fontSize: "var(--fs-label)", color: "var(--muted)", fontWeight: 400, marginBottom: 18 }}>One-time listings whose end date has passed. Recurring listings always stay in My listings.</p>
              <div className="cards-grid">
                {panelState ?? (historyOpps.length ? historyOpps.map((o) => listingCard(o, true)) : (
                  <div className="empty"><div className="empty-icon"><Archive size={40} strokeWidth={1.75} aria-hidden /></div>No expired listings yet.</div>
                ))}
              </div>
            </div>
          )}

          {tab === "profile" && (
            <div className="tab-panel on">
              <h1 className="dash-h">Organization profile</h1>
              <div className="form-box" style={{ maxWidth: 580 }}>
                {/* Disabled because nothing saves it. `saveProfile` sends only
                    email_notifications and `api.updateMe` accepts only
                    email_notifications/portfolio_public — so an org could edit this,
                    press Save changes, see "Saved ✓" and lose the value silently
                    (audit 2026-08-06). Re-enable when a backend field exists. */}
                <div className="fr">
                  <label htmlFor="applicants-org-name">Organization name</label>
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
                <button className="fsubmit" onClick={saveProfile}>Save changes</button>
                {savedProfile && <span style={{ marginLeft: 12, fontSize: "var(--fs-label)", color: "var(--green)" }}>Saved <Check size={16} strokeWidth={1.75} aria-hidden /></span>}
                {profileError && <div className="ferr" role="alert" style={{ display: "block", marginTop: 10 }}>{profileError}</div>}
                <div style={{ marginTop: 20, paddingTop: 20, borderTop: "1px solid var(--border)", display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <Link className="btn-s btn-sm" href="/billing">Manage billing</Link>
                  <button className="btn-s btn-sm" onClick={downloadExport}><Download size={15} strokeWidth={1.75} aria-hidden /> Download my data (JSON)</button>
                </div>
                <div className="delete-zone" style={{ maxWidth: 580 }}>
                  <h4><TriangleAlert size={16} strokeWidth={1.75} aria-hidden /> Delete account</h4>
                  <p>
                    Your account is deactivated right away. After 48 hours, your profile, login, messages you sent, and
                    notifications are permanently erased. Your past listings and the hours you verified are kept so your
                    volunteers’ records stay intact.
                    You must deactivate all active listings first (the Deactivate button on each card in My listings and Listing history).{" "}
                    <strong>Log in within 48 hours to restore your account.</strong>
                  </p>
                  {user.plan === "pro" && (
                    <p>
                      <strong>Your organization is on the Pro plan.</strong> If no one logs in with this
                      account&rsquo;s main email ({user.email}) and chooses Restore within 48 hours, the deletion
                      becomes final: your Pro subscription is cancelled and the rest of your current Pro month is
                      lost. It is not refunded.
                    </p>
                  )}
                  <div className="fr">
                    <label htmlFor="applicants-delete-confirm">Type DELETE to confirm</label>
                    <input id="applicants-delete-confirm" className="fc" value={delConfirm} onChange={(e) => setDelConfirm(e.target.value)} placeholder="DELETE" />
                  </div>
                  <div className="fr">
                    <label htmlFor="applicants-delete-password">Current password</label>
                    <input id="applicants-delete-password" className="fc" type="password" value={delPassword} onChange={(e) => setDelPassword(e.target.value)} />
                  </div>
                  {deleteError && <div className="ferr" role="alert" style={{ display: "block" }}>{deleteError}</div>}
                  <button
                    className="btn-s btn-sm btn-danger"
                    disabled={delConfirm !== "DELETE" || !delPassword || deleting}
                    onClick={deleteAccount}
                  >{deleting ? "Deleting…" : "Delete organization account"}</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </V1Shell>
  );
}

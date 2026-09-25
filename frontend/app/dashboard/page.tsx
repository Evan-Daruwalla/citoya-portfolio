"use client";

import { Bookmark, CalendarDays, ChartColumn, ClipboardList, Clock, Download, Lock, MapPin, Plus, Settings, TriangleAlert, Trophy, User, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";

import { ConsentBanner } from "@/components/consent-banner";
import { V1Shell } from "@/components/v1/v1-shell";
import { ApiError, api } from "@/lib/api";
import { TOKEN_KEY, useAuth } from "@/lib/auth-context";
import { eventDateKey, localDateKey } from "@/lib/event-time";
import { HOURS_STATUS_LABEL_COMPACT, HOURS_STATUS_PILL } from "@/lib/status";
import { useAuthedQuery } from "@/lib/use-api";

type Tab = "calendar" | "history" | "log" | "saved" | "awards" | "impact" | "profile" | "account";
const TABS: { id: Tab; label: string; Icon: LucideIcon }[] = [
  { id: "calendar", label: "Calendar", Icon: CalendarDays },
  { id: "history", label: "Hours History", Icon: ClipboardList },
  { id: "log", label: "Log Hours", Icon: Plus },
  { id: "saved", label: "Saved", Icon: Bookmark },
  { id: "awards", label: "Awards", Icon: Trophy },
  { id: "impact", label: "Impact", Icon: ChartColumn },
  { id: "profile", label: "Profile", Icon: User },
  { id: "account", label: "Account", Icon: Settings },
];
const SRC: Record<string, string> = { auto: "Auto", self: "Self-report", checkin: "Check-in" };
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function DashboardPage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("calendar");
  // Keys are shared with the pages that already read the same data (`hours/mine`
  // and `awards/my` with /portfolio, `applications/my` with /applications,
  // `saved` with /saved) — that shared cache entry is the point of the key.
  const isStudent = user?.role === "student";
  const hoursQ = useAuthedQuery(isStudent ? "hours/mine" : null, (t) => api.listHours(t));
  const awardsQ = useAuthedQuery(isStudent ? "awards/my" : null, (t) => api.myAwards(t));
  const appsQ = useAuthedQuery(isStudent ? "applications/my" : null, (t) => api.myApplications(t));
  const savedQ = useAuthedQuery(isStudent ? "saved" : null, (t) => api.listSaved(t));
  // Memoized only to keep the `stats` useMemo below off a fresh [] each render.
  const hours = useMemo(() => hoursQ.data ?? [], [hoursQ.data]);
  const awards = awardsQ.data ?? null;
  const apps = appsQ.data ?? [];
  const saved = savedQ.data ?? [];
  // One combined pair, unchanged from the pre-SWR shape: every tab body still
  // shows a skeleton while anything loads and one inline error if anything fails.
  const dataLoading = hoursQ.loading || awardsQ.loading || appsQ.loading || savedQ.loading;
  const dataError = Boolean(hoursQ.error || awardsQ.error || appsQ.error || savedQ.error);
  // log-hours form
  const [srOpp, setSrOpp] = useState("");
  const [srHours, setSrHours] = useState(1);
  const [ciOpp, setCiOpp] = useState("");
  const [ciCode, setCiCode] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  // One flag for both forms (they share one message line). Before 2026-09-22 the
  // buttons disabled only on empty fields, which stay filled through the request, so
  // a double-click sent two POSTs — two pending self-reports (Appendix AD, MED).
  const [submitting, setSubmitting] = useState(false);
  // account section (export + delete)
  const [delConfirm, setDelConfirm] = useState("");
  const [delPassword, setDelPassword] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [acctError, setAcctError] = useState<string | null>(null);

  function refresh() {
    hoursQ.retry();
    awardsQ.retry();
    appsQ.retry();
    savedQ.retry();
  }

  // Auto-log is a WRITE, so it cannot live inside a cached read: SWR revalidates
  // on focus and reconnect, and each of those would re-POST. It runs once per
  // mount instead, and only forces a re-read when it actually minted rows — the
  // common case is `created: 0`, where the queries above already have the truth.
  // (Idempotent server-side: `/hours/auto-log` skips any occurrence date that
  // already has a row, so a repeat is a no-op, not a duplicate.)
  const autoLogged = useRef(false);
  const { mutate: mutateHours } = hoursQ;
  const { mutate: mutateAwards } = awardsQ;
  useEffect(() => {
    if (loading || !isStudent || autoLogged.current) return;
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;
    autoLogged.current = true;
    api.autoLogHours(token)
      .then((r) => {
        if (r.created > 0) {
          void mutateHours();
          void mutateAwards();
        }
      })
      .catch(() => undefined);
  }, [loading, isStudent, mutateHours, mutateAwards]);

  const stats = useMemo(() => {
    let verified = 0, pending = 0, total = 0;
    for (const h of hours) {
      total += h.hours;
      if (h.status === "verified") verified += h.hours;
      else if (h.status === "pending" || h.status === "appealed") pending += h.hours;
    }
    return { verified, pending, total };
  }, [hours]);

  const oppOptions = apps.map((a) => ({ id: a.opportunity.id, title: a.opportunity.title }));

  async function submitSelfReport(e: FormEvent) {
    e.preventDefault();
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token || !srOpp) return;
    setSubmitting(true);
    setMsg(null);
    try {
      await api.selfReportHours({ opportunity_id: srOpp, hours: srHours }, token);
      setMsg("Hours submitted for verification.");
      refresh();
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }
  async function submitCheckin(e: FormEvent) {
    e.preventDefault();
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token || !ciOpp || !ciCode) return;
    setSubmitting(true);
    setMsg(null);
    try {
      await api.redeemCheckin(ciOpp, ciCode.trim().toUpperCase(), token);
      setCiCode("");
      setMsg("Checked in. Hours verified!");
      refresh();
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  async function downloadExport() {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;
    setAcctError(null);
    try {
      const data = await api.exportMe(token);
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = "citoya-data-export.json";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setAcctError(err instanceof ApiError ? err.message : "Could not export your data.");
    }
  }
  async function deleteAccount() {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;
    setDeleting(true);
    setAcctError(null);
    try {
      await api.deleteMe(delPassword, token);
      logout();
      router.push("/");
    } catch (err) {
      setAcctError(err instanceof ApiError ? err.message : "Could not delete your account.");
      setDeleting(false);
    }
  }

  if (loading) return null;
  if (!user || user.role !== "student") {
    return (
      <V1Shell>
        <div className="section"><p className="sec-sub">Your dashboard is for student accounts.</p></div>
      </V1Shell>
    );
  }

  const initial = (user.full_name || user.email || "?").trim().charAt(0).toUpperCase();

  // calendar month grid (current month) with event dates from applications
  const eventDays = new Set(apps.map((a) => eventDateKey(a.opportunity.start_time, a.opportunity.timezone)));
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const gridStart = new Date(monthStart);
  gridStart.setDate(1 - monthStart.getDay());
  const days = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    return d;
  });

  // Per-section resilience (M13.5): the four queries are separate since the SWR
  // conversion, but `dataLoading`/`dataError` still combine them, so a single
  // skeleton-while-loading + inline error+Retry covers every data tab. Splitting
  // to per-panel errors is now possible and is deliberately NOT done here.
  const sectionError = (
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
  const skelPanel = (
    <div className="skel-card" aria-busy="true">
      <div className="skel skel-line" style={{ width: "55%", height: 16, marginBottom: 14 }} />
      <div className="skel skel-line" style={{ width: "100%", marginBottom: 8 }} />
      <div className="skel skel-line" style={{ width: "92%", marginBottom: 8 }} />
      <div className="skel skel-line" style={{ width: "78%" }} />
    </div>
  );
  const skelGrid = (
    <div className="cards-grid" aria-busy="true">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="skel-card">
          <div className="skel skel-line" style={{ width: "70%", height: 16, marginBottom: 10 }} />
          <div className="skel skel-line" style={{ width: "45%", marginBottom: 14 }} />
          <div className="skel skel-line" style={{ width: "60%" }} />
        </div>
      ))}
    </div>
  );

  return (
    <V1Shell>
      <div className="dash-layout">
        {/* SIDEBAR */}
        <div>
          <div className="dash-sidebar">
            <div className="ds-avatar">{initial}</div>
            <div className="ds-name">{user.full_name ?? user.email}</div>
            <div className="ds-role">Student</div>
            <hr className="ds-divider" />
            <div className="ds-stat">
              <span className="ds-stat-label">Verified Hours</span>
              {/* Gated on dataError like every tab body below (240+). Ungated,
                  a failed load showed "0 Verified Hours" — `hours` stays [] and
                  is never reset — and a failed REFRESH after a good load showed
                  stale-but-plausible counts with no staleness cue, which is
                  worse because it looks right (audit 2026-09-02). */}
              <span className="ds-stat-val big">{dataError ? "—" : stats.verified}</span>
            </div>
            <div className="ds-stat">
              <span className="ds-stat-label">Unverified Hours</span>
              <span className="ds-stat-val">{dataError ? "—" : stats.pending}</span>
            </div>
            <div className="ds-stat">
              <span className="ds-stat-label">Total Logged</span>
              <span className="ds-stat-val">{dataError ? "—" : stats.total}</span>
            </div>
            <hr className="ds-divider" />
            <div className="ds-nav">
              {TABS.map((t) => (
                <button key={t.id} className={`ds-link${tab === t.id ? " on" : ""}`} onClick={() => setTab(t.id)}>
                  <t.Icon size={15} strokeWidth={1.75} aria-hidden />{t.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* MAIN */}
        <div className="dash-main">
          {/* M5: the only surface where a gated student can resend the guardian
              email or re-check status. It existed but was never mounted anywhere,
              so the whole consent flow was unreachable from the UI (audit
              2026-08-05). Self-hides for adults and consent-cleared students. */}
          <ConsentBanner />
          {tab === "calendar" && (
            <div>
              <h1 className="dash-h">Calendar</h1>
              {dataError ? sectionError : dataLoading ? skelPanel : (
              <>
              <div className="cal-wrap">
                <div className="cal-hdr">
                  <span className="cal-title">{now.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</span>
                </div>
                <div className="cal-grid">
                  {DOW.map((d) => (
                    <div key={d} className="cal-day-head">{d}</div>
                  ))}
                  {days.map((d, i) => {
                    const otherMonth = d.getMonth() !== now.getMonth();
                    const isToday = d.toDateString() === now.toDateString();
                    const evs = apps.filter((a) => eventDateKey(a.opportunity.start_time, a.opportunity.timezone) === localDateKey(d));
                    return (
                      <div key={i} className={`cal-day${otherMonth ? " other-month" : ""}${isToday ? " today" : ""}`}>
                        <div className="cal-date">{d.getDate()}</div>
                        {evs.map((a) => (
                          <div key={a.id} className="cal-event" title={a.opportunity.title}>{a.opportunity.title}</div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
              {eventDays.size === 0 && <p className="progress-label" style={{ marginTop: 12 }}>No signups this month: <Link href="/discover">find an opportunity</Link>.</p>}
              </>
              )}
            </div>
          )}

          {tab === "history" && (
            <div>
              <h1 className="dash-h">Hours History</h1>
              {dataError ? sectionError : dataLoading ? skelPanel : hours.length === 0 ? (
                <div className="empty"><div className="empty-icon"><ClipboardList size={40} strokeWidth={1.75} aria-hidden /></div>No hours logged yet. They log automatically once an event passes.</div>
              ) : (
                <table className="tbl">
                  <thead>
                    <tr><th>Opportunity</th><th>Hours</th><th>Source</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    {hours.map((h) => (
                      <tr key={h.id}>
                        <td>{h.opportunity.title}</td>
                        <td>{h.hours}</td>
                        <td>{SRC[h.source] ?? h.source}</td>
                        <td><span className={`status-pill ${HOURS_STATUS_PILL[h.status] ?? "sp-pending"}`}>{HOURS_STATUS_LABEL_COMPACT[h.status] ?? h.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {tab === "log" && (
            <div>
              <h1 className="dash-h">Log Hours</h1>
              {dataError ? sectionError : dataLoading ? skelPanel : oppOptions.length === 0 ? (
                <div className="empty"><div className="empty-icon"><Plus size={40} strokeWidth={1.75} aria-hidden /></div>Apply to an opportunity first, then log or check in here.</div>
              ) : (
                <>
                  <div className="form-box">
                    <form onSubmit={submitCheckin}>
                      <div className="fr"><label htmlFor="dashboard-checkin-opportunity">Check in with a code</label></div>
                      <div className="checkin-bar">
                        <select id="dashboard-checkin-opportunity" className="fsel" value={ciOpp} onChange={(e) => setCiOpp(e.target.value)}>
                          <option value="">Opportunity…</option>
                          {oppOptions.map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}
                        </select>
                        <input className="fsel" style={{ width: 110, textTransform: "uppercase" }} value={ciCode} onChange={(e) => setCiCode(e.target.value)} placeholder="CODE" />
                        <button className="btn-p" type="submit" style={{ padding: "9px 18px", fontSize: ".82rem" }} disabled={submitting || !ciOpp || !ciCode}>Check in</button>
                      </div>
                    </form>
                  </div>
                  <div className="form-box">
                    <form onSubmit={submitSelfReport}>
                      <div className="fr"><label htmlFor="dashboard-selfreport-opportunity">Self-report hours</label></div>
                      <div className="checkin-bar">
                        <select id="dashboard-selfreport-opportunity" className="fsel" value={srOpp} onChange={(e) => setSrOpp(e.target.value)}>
                          <option value="">Opportunity…</option>
                          {oppOptions.map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}
                        </select>
                        <input className="fsel" style={{ width: 80 }} type="number" min={0.5} step={0.5} value={srHours} onChange={(e) => setSrHours(Number(e.target.value))} />
                        <button className="btn-p" type="submit" style={{ padding: "9px 18px", fontSize: ".82rem" }} disabled={submitting || !srOpp}>Submit</button>
                      </div>
                    </form>
                  </div>
                  {msg && <p className="progress-label">{msg}</p>}
                </>
              )}
            </div>
          )}

          {tab === "saved" && (
            <div>
              <h1 className="dash-h">Saved</h1>
              {dataError ? sectionError : dataLoading ? skelGrid : saved.length === 0 ? (
                <div className="empty"><div className="empty-icon"><Bookmark size={40} strokeWidth={1.75} aria-hidden /></div>No bookmarks yet. Tap the heart on any opportunity.</div>
              ) : (
                <div className="cards-grid">
                  {saved.map((o) => (
                    <Link key={o.id} href={`/opportunities/${o.id}`} className="opp-card">
                      <div className="oc-title">{o.title}</div>
                      <div className="oc-org">{o.org_name}</div>
                      <div className="oc-meta"><span><MapPin size={13} strokeWidth={1.75} aria-hidden />{o.location}</span><span><Clock size={13} strokeWidth={1.75} aria-hidden />{o.duration_hours} hrs</span></div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === "awards" && (
            <div>
              <h1 className="dash-h">Awards: {awards?.verified_hours ?? 0} verified hours</h1>
              {dataError ? sectionError : dataLoading ? skelPanel : (
              <>
              {(awards?.earned ?? []).map((a) => (
                <div key={a.id} className="award-card">
                  <div className="award-icon award-achieved"><Trophy size={24} strokeWidth={1.75} aria-hidden /></div>
                  <div className="award-info">
                    <div className="award-name">{a.name}</div>
                    <div className="award-desc">Achieved</div>
                    <div className="progress-bar"><div className="progress-fill done" style={{ width: "100%" }} /></div>
                  </div>
                </div>
              ))}
              {awards?.next && (
                <div className="award-card">
                  <div className="award-icon award-locked"><Lock size={24} strokeWidth={1.75} aria-hidden /></div>
                  <div className="award-info">
                    <div className="award-name">{awards.next.name}</div>
                    <div className="award-desc">{awards.next.hours - awards.verified_hours}h to go ({awards.next.hours}h)</div>
                    <div className="progress-bar"><div className="progress-fill" style={{ width: `${Math.min(100, (awards.verified_hours / awards.next.hours) * 100)}%` }} /></div>
                  </div>
                </div>
              )}
              {(awards?.earned.length ?? 0) === 0 && !awards?.next && (
                <div className="empty"><div className="empty-icon"><Trophy size={40} strokeWidth={1.75} aria-hidden /></div>Log verified hours to start earning awards.</div>
              )}
              </>
              )}
            </div>
          )}

          {tab === "impact" && (
            <div>
              <h1 className="dash-h">Impact</h1>
              {dataError ? sectionError : dataLoading ? skelPanel : (
              <div className="lb-band">
                <div className="lb-stat"><div className="lb-stat-num">{stats.verified}</div><div className="lb-stat-label">Verified Hours</div></div>
                <div className="lb-stat"><div className="lb-stat-num">{apps.length}</div><div className="lb-stat-label">Opportunities</div></div>
                <div className="lb-stat"><div className="lb-stat-num">{awards?.earned.length ?? 0}</div><div className="lb-stat-label">Awards</div></div>
              </div>
              )}
            </div>
          )}

          {tab === "profile" && (
            <div>
              <h1 className="dash-h">Profile</h1>
              <div className="form-box">
                <div className="ds-stat"><span className="ds-stat-label">Name</span><span className="ds-stat-val">{user.full_name ?? "—"}</span></div>
                <div className="ds-stat"><span className="ds-stat-label">Email</span><span className="ds-stat-val">{user.email}</span></div>
                <div className="ds-stat"><span className="ds-stat-label">Role</span><span className="ds-stat-val">Student</span></div>
              </div>
            </div>
          )}

          {tab === "account" && (
            <div>
              <h1 className="dash-h">Account</h1>
              <div className="form-box">
                <div className="fr"><label htmlFor="dashboard-download-data">Download my data</label></div>
                <p style={{ fontSize: ".83rem", color: "var(--muted)", fontWeight: 300, marginBottom: 12 }}>Download everything Citoya has on you as one JSON file: profile, applications, hours, messages, reviews, and notifications.</p>
                <button id="dashboard-download-data" className="btn-s" style={{ padding: "9px 18px", fontSize: ".83rem" }} onClick={downloadExport}><Download size={15} strokeWidth={1.75} aria-hidden /> Download my data (JSON)</button>
              </div>
              <div className="delete-zone">
                <h4><TriangleAlert size={16} strokeWidth={1.75} aria-hidden /> Delete Account</h4>
                <p>
                  Your verified hours are kept for the organizations that recorded them, with your name removed.
                  Everything else (your profile, guardian information, saved items, and notifications) is permanently erased.
                  <strong> This cannot be undone.</strong>
                </p>
                <div className="fr">
                  <label htmlFor="dashboard-delete-confirm">Type DELETE to confirm</label>
                  <input id="dashboard-delete-confirm" className="fc" value={delConfirm} onChange={(e) => setDelConfirm(e.target.value)} placeholder="DELETE" />
                </div>
                <div className="fr">
                  <label htmlFor="dashboard-delete-password">Current password</label>
                  <input id="dashboard-delete-password" className="fc" type="password" value={delPassword} onChange={(e) => setDelPassword(e.target.value)} />
                </div>
                {acctError && <div className="ferr" style={{ display: "block" }}>{acctError}</div>}
                <button
                  className="btn-s"
                  style={{ color: "var(--red)", borderColor: "var(--red)", padding: "9px 18px", fontSize: ".83rem" }}
                  disabled={delConfirm !== "DELETE" || !delPassword || deleting}
                  onClick={deleteAccount}
                >{deleting ? "Deleting…" : "Delete my account"}</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </V1Shell>
  );
}

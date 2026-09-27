"use client";

import { TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, api } from "@/lib/api";
import { TOKEN_KEY, useAuth } from "@/lib/auth-context";
import { CONSENT_GATED_COPY, consentGated } from "@/lib/consent";
import { localDateKey } from "@/lib/event-time";
import { splitGoals } from "@/lib/goals";
import { hoursDateKey, hoursTitle } from "@/lib/hours";
import { HOURS_STATUS_LABEL, HOURS_STATUS_PILL } from "@/lib/status";
import { useAuthedQuery } from "@/lib/use-api";
import { useOffsiteHours } from "@/lib/use-offsite-hours";

const SOURCE_LABEL: Record<string, string> = { auto: "Auto-logged", self: "Self-reported", checkin: "Check-in", offsite: "Outside Citoya" };

export default function MyHoursPage() {
  const { user, loading } = useAuth();
  const isStudent = user?.role === "student";
  const gated = consentGated(user); // K3: never send a write the gate refuses
  // Keys are shared with `/dashboard` (and `hours/mine` with `/portfolio`) — the
  // same data behind one cache entry is the point of the key.
  const hoursQ = useAuthedQuery(isStudent ? "hours/mine" : null, (t) => api.listAllHours(t));
  const goalsQ = useAuthedQuery(isStudent ? "goals" : null, (t) => api.listGoals(t));
  const appsQ = useAuthedQuery(isStudent ? "applications/my" : null, (t) => api.myApplications(t));

  // Memoized only to keep the goal useMemo below off a fresh [] each render.
  const entries = useMemo(() => hoursQ.data ?? [], [hoursQ.data]);
  const apps = appsQ.data ?? [];
  const goalRows = useMemo(
    () =>
      splitGoals(
        goalsQ.data?.goals ?? [],
        entries.map((h) => ({ date: hoursDateKey(h), hours: h.hours, status: h.status })),
        localDateKey(new Date()),
      ),
    [entries, goalsQ.data],
  );

  const [busyId, setBusyId] = useState<string | null>(null);

  // self-report + check-in form state
  const [srOpp, setSrOpp] = useState("");
  const [srHours, setSrHours] = useState(1);
  const [srNote, setSrNote] = useState("");
  const [ciOpp, setCiOpp] = useState("");
  const [ciCode, setCiCode] = useState("");
  // Success and failure were ONE `formMsg` until this conversion, rendered in the
  // muted body colour — so "Something went wrong." looked exactly like "Hours
  // submitted for verification." Two variables, and the failure gets `.ferr`.
  const [formMsg, setFormMsg] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  // One flag for both forms (they share one message line). Before 2026-09-22 the
  // buttons disabled only on empty fields, which stay filled through the request, so
  // a double-click sent two POSTs — two pending self-reports (Appendix AD, MED).
  const [submitting, setSubmitting] = useState(false);

  const { mutate: mutateHours } = hoursQ;
  const offsite = useOffsiteHours(() => void mutateHours());

  // Auto-log is a WRITE and cannot live inside a cached read: SWR revalidates on
  // focus and on reconnect, and each of those would re-POST. Before this
  // conversion it was the FIRST call of a `refresh()` that every write and the
  // Retry button also called, so a denied-hours appeal, a self-report, a check-in
  // and every press of Retry each fired another `POST /hours/auto-log`.
  //
  // It runs once per mount instead, and only forces a re-read when it actually
  // minted rows — `created: 0` is the common answer, and there the queries above
  // already hold the truth. The ref is set BEFORE the call so a failure cannot
  // re-fire it on this mount. (Same shape as `dashboard/page.tsx`; the recipe is
  // in `.claude/codebase-memory/conventions.md` under "A WRITE in a page's loader
  // never goes inside a fetcher".)
  const autoLogged = useRef(false);
  useEffect(() => {
    if (loading || !isStudent || gated || autoLogged.current) return;
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;
    autoLogged.current = true;
    api
      .autoLogHours(token)
      .then((r) => {
        // Goal progress is computed from hours, so re-reading hours is enough.
        if (r.created > 0) void mutateHours();
      })
      .catch(() => undefined);
  }, [loading, isStudent, gated, mutateHours]);

  /** The Retry button. Re-reads only — it must never POST. */
  function retryAll() {
    hoursQ.retry();
    goalsQ.retry();
    appsQ.retry();
  }

  async function appeal(id: string) {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;
    setBusyId(id);
    setFormError(null);
    try {
      await api.appealHours(id, "Requesting another review.", token);
      // An appeal moves one row denied -> appealed; goals read hours, so this is all.
      void mutateHours();
    } catch (err) {
      // Was `try`/`finally` with NO catch: a failed appeal showed the user
      // nothing at all and raised an unhandled promise rejection.
      setFormError(err instanceof ApiError ? err.message : "Couldn't submit that appeal.");
    } finally {
      setBusyId(null);
    }
  }

  async function submitSelfReport(e: FormEvent) {
    e.preventDefault();
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token || !srOpp) return;
    setSubmitting(true);
    setFormMsg(null);
    setFormError(null);
    try {
      await api.selfReportHours({ opportunity_id: srOpp, hours: srHours, note: srNote || undefined }, token);
      setSrNote("");
      setFormMsg("Hours submitted for verification.");
      // Self-reported hours land as PENDING; goal progress re-derives from hours.
      void mutateHours();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitCheckin(e: FormEvent) {
    e.preventDefault();
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token || !ciOpp || !ciCode) return;
    setSubmitting(true);
    setFormMsg(null);
    setFormError(null);
    try {
      await api.redeemCheckin(ciOpp, ciCode.trim().toUpperCase(), token);
      setCiCode("");
      setFormMsg("Checked in. Hours verified!");
      // A redeemed code mints INSTANTLY-VERIFIED hours; goal progress re-derives
      // from hours, so re-reading hours is enough.
      void mutateHours();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return null;
  if (!user || user.role !== "student") {
    return (
      <main className="mx-auto max-w-md p-8 text-center">
        <p className="text-muted-foreground">Only student accounts have hours.</p>
      </main>
    );
  }

  const oppOptions = apps.map((a) => ({ id: a.opportunity.id, title: a.opportunity.title }));

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-8">
      <div>
        <span className="section-tag">Your activity</span>
        <h1 className="section-title">My Hours</h1>
      </div>

      {/* Goals replace awards here (M16.3, 2026-09-27): the goals still in progress, with
          this period's progress. They are managed on the dashboard's Goals tab. */}
      {goalsQ.data && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Goals</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 text-sm">
            {goalRows.active.length > 0 ? (
              goalRows.active.slice(0, 3).map(({ goal, progress }) => (
                <p key={goal.id}>
                  {goal.title}: {Number(progress.done.toFixed(1))} of {goal.target_hours} hours
                </p>
              ))
            ) : (
              <p className="text-muted-foreground">No goals in progress.</p>
            )}
            {goalRows.completed.length > 0 && (
              <p className="text-primary">{goalRows.completed.length} completed</p>
            )}
            <p className="text-muted-foreground">
              Add, remove or reorder goals on your <Link href="/dashboard">dashboard</Link>, under Goals.
            </p>
            {/* SWR keeps the last good value when a revalidation fails, so without
                this line the card would keep showing figures that may have moved,
                looking exactly as if they were current. */}
            {goalsQ.error && (
              <p className="progress-label">Couldn&apos;t refresh — showing the last goals we loaded.</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* The forms used to render only on `oppOptions.length > 0`, so a FAILED
          `applications/my` load hid them with no message — identical on screen to
          a student who has never been approved for anything. */}
      {appsQ.error && (
        <Card>
          <CardContent className="flex flex-col items-start gap-2 pt-6 text-sm">
            <p className="ferr" style={{ marginBottom: 0 }}>
              Couldn&apos;t load your opportunities, so check-in and self-report aren&apos;t available.
            </p>
            <button className="btn-s" style={{ padding: "8px 16px", fontSize: ".8rem" }} onClick={retryAll}>
              Retry
            </button>
          </CardContent>
        </Card>
      )}

      {!appsQ.error && oppOptions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Log or check in</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            {gated && <p className="text-sm text-muted-foreground">{CONSENT_GATED_COPY}</p>}
            <form onSubmit={submitCheckin} className="flex flex-col gap-2">
              <Label htmlFor="hours-checkin-opportunity">Check in with a code</Label>
              <div className="flex gap-2">
                <select
                  id="hours-checkin-opportunity"
                  value={ciOpp}
                  onChange={(e) => setCiOpp(e.target.value)}
                  className="h-9 flex-1 rounded-md border border-input bg-transparent px-3 text-sm"
                >
                  <option value="">Opportunity…</option>
                  {oppOptions.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.title}
                    </option>
                  ))}
                </select>
                <Input
                  aria-label="Check-in code"
                  value={ciCode}
                  onChange={(e) => setCiCode(e.target.value)}
                  placeholder="CODE"
                  className="w-28 uppercase"
                />
                <Button type="submit" size="sm" disabled={gated || submitting || !ciOpp || !ciCode}>
                  Check in
                </Button>
              </div>
            </form>

            <form onSubmit={submitSelfReport} className="flex flex-col gap-2 border-t pt-4">
              <Label htmlFor="hours-selfreport-opportunity">Self-report hours</Label>
              <div className="flex gap-2">
                <select
                  id="hours-selfreport-opportunity"
                  value={srOpp}
                  onChange={(e) => setSrOpp(e.target.value)}
                  className="h-9 flex-1 rounded-md border border-input bg-transparent px-3 text-sm"
                >
                  <option value="">Opportunity…</option>
                  {oppOptions.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.title}
                    </option>
                  ))}
                </select>
                <Input
                  aria-label="Hours to report"
                  type="number"
                  min={0.5}
                  step={0.5}
                  value={srHours}
                  onChange={(e) => setSrHours(Number(e.target.value))}
                  className="w-20"
                />
                <Button type="submit" size="sm" disabled={gated || submitting || !srOpp}>
                  Submit
                </Button>
              </div>
              <Input
                value={srNote}
                onChange={(e) => setSrNote(e.target.value)}
                placeholder="Note (optional)"
                aria-label="Note (optional)"
              />
            </form>
            {formMsg && <p className="text-sm text-muted-foreground">{formMsg}</p>}
          </CardContent>
        </Card>
      )}

      {/* Off-site hours (2026-09-27): no listing, so this card does not wait on
          `applications/my` the way the check-in card above does. */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Volunteering outside Citoya</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={offsite.submit} className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              Log service you did somewhere else. It is marked self-reported and never counts as verified, because no
              organization on Citoya can confirm it.
            </p>
            {gated && <p className="text-sm text-muted-foreground">{CONSENT_GATED_COPY}</p>}
            <div className="flex flex-col gap-1">
              <Label htmlFor="offsite-activity">What you did, and where</Label>
              <Input
                id="offsite-activity"
                value={offsite.fields.activity}
                onChange={(e) => offsite.fields.setActivity(e.target.value)}
                maxLength={200}
                placeholder="Food bank sorting at St. Mark's"
              />
            </div>
            <div className="flex gap-2">
              <div className="flex flex-1 flex-col gap-1">
                <Label htmlFor="offsite-date">Date</Label>
                <Input
                  id="offsite-date"
                  type="date"
                  max={offsite.today}
                  value={offsite.fields.date}
                  onChange={(e) => offsite.fields.setDate(e.target.value)}
                />
              </div>
              <div className="flex w-24 flex-col gap-1">
                <Label htmlFor="offsite-hours">Hours</Label>
                <Input
                  id="offsite-hours"
                  type="number"
                  min={0.5}
                  max={24}
                  step={0.5}
                  value={offsite.fields.hours}
                  onChange={(e) => offsite.fields.setHours(Number(e.target.value))}
                />
              </div>
            </div>
            <Input
              value={offsite.fields.supervisor}
              onChange={(e) => offsite.fields.setSupervisor(e.target.value)}
              maxLength={200}
              placeholder="Supervisor (optional)"
              aria-label="Supervisor (optional)"
            />
            <Input
              value={offsite.fields.note}
              onChange={(e) => offsite.fields.setNote(e.target.value)}
              maxLength={500}
              placeholder="Note (optional)"
              aria-label="Note for off-site hours (optional)"
            />
            <div>
              <Button type="submit" size="sm" disabled={gated || offsite.submitting || !offsite.fields.activity.trim()}>
                Log off-site hours
              </Button>
            </div>
            {offsite.message && <p className="text-sm text-muted-foreground">{offsite.message}</p>}
            {offsite.error && <p className="ferr" style={{ marginBottom: 0 }}>{offsite.error}</p>}
          </form>
        </CardContent>
      </Card>

      {/* ONE render site for write failures. It sits outside the forms card
          because Appeal lives in the entry list below and can fail while the
          card is not rendered at all. */}
      {formError && <p className="ferr" style={{ marginBottom: 0 }}>{formError}</p>}

      {hoursQ.loading && <p className="empty-state">Loading…</p>}

      {/* The FIRST load failed — there is nothing to show, so the full panel.
          `data === undefined` and not `entries.length === 0`, because a load that
          succeeds and returns [] is a different thing that gets the empty copy. */}
      {!hoursQ.loading && hoursQ.error && hoursQ.data === undefined && (
        <div className="load-error">
          <div className="empty-icon"><TriangleAlert size={40} strokeWidth={1.75} aria-hidden /></div>
          <div className="ferr">Couldn&apos;t load your hours. Check your connection and try again.</div>
          <div>
            <button className="btn-s" style={{ padding: "9px 18px", fontSize: ".83rem" }} onClick={retryAll}>
              Retry
            </button>
          </div>
        </div>
      )}

      {/* A REVALIDATION failed while we still hold good rows. Before SWR this
          state did not exist — nothing refetched on its own — so raising the
          full-page panel over a list the student can still read would be new
          noise, not new honesty. */}
      {hoursQ.error && hoursQ.data !== undefined && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <p className="progress-label" style={{ marginTop: 0 }}>
            Couldn&apos;t refresh — these are the hours we last loaded.
          </p>
          <button className="btn-s" style={{ padding: "6px 14px", fontSize: ".78rem" }} onClick={retryAll}>
            Retry
          </button>
        </div>
      )}
      {/* `!hoursQ.error` matters: an empty list and a FAILED load are different
          things, and this copy actively explains the emptiness away. */}
      {!hoursQ.loading && !hoursQ.error && entries.length === 0 && (
        <div className="empty-state">No hours logged yet. They log automatically once an event passes.</div>
      )}

      <div className="flex flex-col gap-4">
        {entries.map((entry) => (
          <div key={entry.id} className="opp-card">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="opp-title">{hoursTitle(entry)}</h3>
                <p className="opp-org">
                  {entry.hours}h · {SOURCE_LABEL[entry.source] ?? entry.source}
                </p>
                {entry.status === "denied" && entry.deny_note && (
                  <p className="text-[0.78rem] text-muted-foreground">Reason: {entry.deny_note}</p>
                )}
              </div>
              <div className="flex flex-shrink-0 flex-col items-end gap-2">
                <span className={`status-pill ${HOURS_STATUS_PILL[entry.status] ?? "sp-pending"}`}>
                  {HOURS_STATUS_LABEL[entry.status] ?? entry.status}
                </span>
                {entry.status === "denied" && !entry.appealed && (
                  <Button size="sm" variant="outline" disabled={busyId === entry.id} onClick={() => appeal(entry.id)}>
                    Appeal
                  </Button>
                )}
                {entry.source === "offsite" && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={offsite.busyId === entry.id}
                    onClick={() => offsite.remove(entry.id)}
                    aria-label={`Delete ${hoursTitle(entry)}`}
                  >
                    Delete
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}

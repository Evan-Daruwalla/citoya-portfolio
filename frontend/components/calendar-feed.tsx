"use client";

// Subscribe in Apple or Google Calendar (M16.5, Evan 2026-09-27: a private feed WITH
// addresses). The link is the credential - a calendar app cannot log in - so the copy
// says plainly who can see what, the link is shown once (only its hash is stored), and
// Reset and Turn off are always one click away. Rendered under the dashboard calendar.
import { CalendarPlus, Copy, RefreshCw, X } from "lucide-react";
import { useState } from "react";

import { ApiError, api } from "@/lib/api";
import { TOKEN_KEY, useAuth } from "@/lib/auth-context";
import { CONSENT_GATED_COPY, consentGated } from "@/lib/consent";
import { useAuthedQuery } from "@/lib/use-api";

type Urls = ReturnType<typeof api.calendarFeedUrls>;

export function CalendarFeed() {
  const { user } = useAuth();
  const gated = consentGated(user);
  const statusQ = useAuthedQuery("calendar/feed", (t) => api.calendarFeedStatus(t));
  const active = statusQ.data?.active ?? false;
  const [urls, setUrls] = useState<Urls | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create(reset: boolean) {
    if (reset && !window.confirm("Reset your calendar link? Calendars using the old link stop updating.")) return;
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;
    setBusy(true);
    setError(null);
    setCopied(false);
    try {
      const r = await api.createCalendarFeed(token);
      setUrls(api.calendarFeedUrls(r.token));
      void statusQ.mutate({ active: true }, { revalidate: false });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't create the link.");
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    if (!window.confirm("Turn off your calendar link? Calendars using it stop updating.")) return;
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      await api.deleteCalendarFeed(token);
      setUrls(null);
      void statusQ.mutate({ active: false }, { revalidate: false });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't turn the link off.");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!urls) return;
    try {
      await navigator.clipboard.writeText(urls.https);
      setCopied(true);
    } catch {
      setError("Couldn't copy. Select the link and copy it by hand.");
    }
  }

  return (
    <div className="form-box" style={{ marginTop: 16 }}>
      <h2 className="goal-section" style={{ marginTop: 0 }}>Add to your phone&apos;s calendar</h2>
      <p className="progress-label" style={{ marginTop: 0, marginBottom: 12 }}>
        A private link your calendar app checks for updates: your signups and your own events, with times and
        addresses. <strong>Anyone who has the link can see them</strong>, so don&apos;t share it. You can reset it or
        turn it off here at any time.
      </p>
      {gated && <p className="progress-label" style={{ marginTop: 0 }}>{CONSENT_GATED_COPY}</p>}

      {urls && (
        <>
          <div className="checkin-bar">
            <a className="btn-p" href={urls.webcal} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 16px", fontSize: ".82rem" }}>
              <CalendarPlus size={14} strokeWidth={1.75} aria-hidden /> Add to Apple Calendar
            </a>
            <a className="btn-s" href={urls.google} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 16px", fontSize: ".82rem" }}>
              <CalendarPlus size={14} strokeWidth={1.75} aria-hidden /> Add to Google Calendar
            </a>
            <button type="button" className="btn-s" onClick={copy} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 16px", fontSize: ".82rem" }}>
              <Copy size={14} strokeWidth={1.75} aria-hidden /> {copied ? "Copied" : "Copy link"}
            </button>
          </div>
          <p className="progress-label" style={{ marginTop: 0 }}>
            This link is shown only now. Google Calendar can take several hours to show changes.
          </p>
        </>
      )}
      {!urls && active && (
        <p className="progress-label" style={{ marginTop: 0 }}>
          Your calendar link is on. For your privacy it can&apos;t be shown again: reset it to get a new one (the old
          one stops working).
        </p>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {!active ? (
          <button type="button" className="btn-p" style={{ padding: "9px 18px", fontSize: ".82rem" }} disabled={busy || gated || statusQ.data === undefined} onClick={() => create(false)}>
            Create my calendar link
          </button>
        ) : (
          <>
            <button type="button" className="btn-s" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", fontSize: ".8rem" }} disabled={busy || gated} onClick={() => create(true)}>
              <RefreshCw size={13} strokeWidth={1.75} aria-hidden /> Reset link
            </button>
            <button type="button" className="btn-s" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", fontSize: ".8rem" }} disabled={busy} onClick={turnOff}>
              <X size={13} strokeWidth={1.75} aria-hidden /> Turn off
            </button>
          </>
        )}
      </div>
      {statusQ.error && <p className="ferr" style={{ marginTop: 12 }}>Couldn&apos;t check your calendar link.</p>}
      {error && <p className="ferr" style={{ marginTop: 12 }}>{error}</p>}
    </div>
  );
}
